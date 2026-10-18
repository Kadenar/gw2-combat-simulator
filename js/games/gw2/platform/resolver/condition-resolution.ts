import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { reviseEffectState } from '#gw2/platform/combat/effect-state.js';
import type { EffectExpansionBudget } from '#gw2/platform/effects/expansion-budget.js';
import type { Gw2ConditionCalculation, SimulationEventBase } from '#gw2/platform/events/events.js';
import { CONDITION_FORMULAS, conditionTickDamage } from '#gw2/platform/combat/formulas.js';
import type { Gw2ModifierContribution } from '#gw2/platform/combat/modifiers.js';
import {
  conditionApplicationDuration,
  type Gw2ConditionDurationTrace
} from '#gw2/platform/combat-calculation/combat-query.js';
import type { Gw2RuntimeConditionEntry, Gw2RuntimeConditionStack } from '#gw2/platform/combat/state/targets.js';
import {
  conditionStackLimit,
  createPermanentTargetConditionStacks,
  GW2_DAMAGING_CONDITIONS
} from '#gw2/platform/combat/state/targets.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ConditionWorkEvent, Gw2ResolverReactionRegistry } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { canonicalTime, isTimeInWindow, timeKey } from '#kernel/core/clock.js';
import { canonicalEvent } from '#kernel/events/queue.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';

interface CreateGw2ConditionResolutionOptions {
  readonly expansionBudget: EffectExpansionBudget;
  readonly reactions: Gw2ResolverReactionRegistry;
  readonly config?: Gw2ResolverRuntime['config'];
}

/**
 * Creates timestamp-aware condition resolution shared by GW2 professions.
 * Successful applications dispatch after state insertion and tick scheduling.
 */
export function createGw2ConditionResolution({
  expansionBudget,
  reactions,
  config = {}
}: CreateGw2ConditionResolutionOptions): Readonly<Gw2ConditionResolution> {
  const permanentTargetConditionStacks = createPermanentTargetConditionStacks(config);
  const environmentWakes = new Map<string, Gw2ResolverEvent>();
  // Equal-weight stacks expanded from one packet have identical attribute inputs, but retain separate damage records.
  const attributeBatches = new WeakMap<Gw2ResolvedConditionApplication, object>();
  // Natural expiry is fixed at acceptance, so each instant's applications are found without scanning every owner.
  const expiryBuckets = new Map<number, Gw2ConditionExpiryBucket>();
  // A binary min-heap of those instants yields the sampler's next expiry wake.
  const expiryHeap: Gw2ConditionExpiryBucket[] = [];
  let bufferWake: Gw2ResolverEvent | undefined;

  // First positive damage fixes the shared phase; integer arithmetic avoids drifting off that phase.
  function nextPulseAt(ctx: Gw2ResolverRuntime, after: number): number {
    const origin = timeKey(ctx.firstHitTime ?? 0);
    return (origin + (Math.floor((timeKey(after) - origin) / 1_000_000) + 1) * 1_000_000) / 1_000_000;
  }

  function activeStacks(ctx: Gw2ResolverRuntime, name: string, at: number): Gw2ResolverConditionStack[] {
    const state = ctx.conditionState.get(name);

    if (!state) return [];

    // Expiry is half-open: a stack is active before expiresAt, not at it.
    return state.stacks.filter((stack) => isTimeInWindow(at, stack.appliedAt, stack.expiresAt) && stack.weight > 0);
  }

  function activeConditionStackCount(ctx: Gw2ResolverRuntime, name: string, at: number): number {
    // Target configuration represents ambient stacks that have no application
    // event, so it is added separately from player-created stack state.
    return Math.min(
      conditionStackLimit(name) ?? Infinity,
      permanentTargetConditionStacks(name) +
        activeStacks(ctx, name, at).reduce((total, stack) => total + stack.weight, 0)
    );
  }

  function conditionRate(ctx: Gw2ResolverRuntime, name: string, conditionDamage: number): number {
    // The shared formula owns Torment's target-motion branch; Confusion adds configured activation damage below.
    let rate = conditionTickDamage(name, conditionDamage, { stationary: !ctx.config.target?.moving });

    if (name === CONDITION.CONFUSION) {
      const formula = CONDITION_FORMULAS.Confusion;
      rate +=
        (ctx.config.target?.confusionActivationsPerSecond || 0) *
        (formula.activationBase + formula.activationScaling * conditionDamage);
    }

    return rate;
  }

  function ensureConditionState(ctx: Gw2ResolverRuntime, name: string): Gw2ResolverConditionState {
    if (!ctx.conditionState.has(name)) {
      ctx.conditionState.set(name, { stacks: [] });
    }

    return ctx.conditionState.get(name)!;
  }

  /**
   * Schedules permanent golem conditions as environment-owned full-second
   * ticks without inserting duplicate stacks into player condition state.
   */
  function initializeEnvironment(ctx: Gw2ResolverRuntime): void {
    for (const condition of GW2_DAMAGING_CONDITIONS) {
      const stacks = permanentTargetConditionStacks(condition);

      if (!(stacks > 0)) continue;

      ctx.environmentConditions.set(condition, {
        name: condition,
        stacks,
        damage: 0,
        stackSeconds: 0,
        damageTicks: []
      });
    }

    scheduleEnvironment(ctx, 0);

    if (ctx.environmentConditions.size) scheduleBuffer(ctx, 0);
  }

  function scheduleEnvironment(ctx: Gw2ResolverRuntime, after: number): void {
    for (const { name: condition, stacks } of ctx.environmentConditions.values()) {
      // Keep one successor per condition even before rotation end is known; rephasing cancels its predecessor.
      const previous = environmentWakes.get(condition);

      if (previous) ctx.queue.cancel(previous);

      const at = nextPulseAt(ctx, after);

      if (ctx.horizon != null && at > ctx.horizon) continue;

      environmentWakes.set(
        condition,
        ctx.queue.enqueue({
          type: 'condition_tick',
          at,
          source: 'Environment',
          sourceId: `environment.target-condition.${condition.toLowerCase()}`,
          actorType: ACTOR.ENVIRONMENT,
          ownerActorType: ACTOR.ENVIRONMENT,
          condition,
          stacks,
          fraction: 1
        })
      );
    }
  }

  /** Replace provisional wakes once first damage establishes fight time; pre-fight accrual cannot fund later ticks. */
  function startDamageClock(ctx: Gw2ResolverRuntime): void {
    const at = ctx.firstHitTime!;

    // An opening condition payout already lies on the provisional phase and must finish its entire batch.
    if (timeKey(at) % 1_000_000 === 0) return;

    for (const state of ctx.conditionState.values()) {
      for (const group of state.groups?.values() ?? []) {
        for (const application of group.applications) {
          application.settledThrough = Math.min(application.naturalExpiresAt, at);
          application.bufferedRawDamage = 0;
          application.bufferedDurationUs = 0;
        }

        pruneGroup(group, at);
        group.nextPulseAt = nextPulseAt(ctx, at);
        scheduleGroup(ctx, group);
      }
    }

    for (const entry of ctx.environmentConditions.values()) entry.bufferedRate = 0;
    scheduleEnvironment(ctx, at);
    ctx.conditionBufferAt = undefined;
    scheduleBuffer(ctx, at);
  }

  /** Summons share player condition packets unless their producer marks an independent pet/mech owner. */
  function damageOwner(application: Gw2ResolvedConditionApplication): string | Gw2ResolvedConditionApplication {
    if (application.actorType === ACTOR.SUMMON) {
      if (!application.independentConditionOwner) return ACTOR.PLAYER;

      return application.summonOwner ? `summon:${application.summonOwner}` : application;
    }

    if (
      application.actorType === ACTOR.PLAYER ||
      (application.actorType === ACTOR.EFFECT && application.ownerActorType === ACTOR.PLAYER)
    )
      return ACTOR.PLAYER;

    // Unclassified actors remain isolated until their producer supplies concrete ownership.
    return application;
  }

  function isRemoved(application: Gw2ResolvedConditionApplication, at: number): boolean {
    return application.removedAt != null && canonicalTime(application.removedAt) <= at;
  }

  /** Keep only unsettled, uncancelled applications so wake scans never grow with encounter history. */
  function pruneGroup(group: Gw2ResolverConditionGroup, at: number): void {
    group.applications = group.applications.filter(
      (application) =>
        !isRemoved(application, at) &&
        (application.bufferedDurationUs > 0 || application.settledThrough < application.naturalExpiresAt)
    );
  }

  /** Record an accepted application under its natural expiry so its expiry sample and wake need no owner scan. */
  function indexExpiry(application: Gw2ResolvedConditionApplication): void {
    const key = timeKey(application.naturalExpiresAt);
    let bucket = expiryBuckets.get(key);

    if (!bucket) {
      bucket = { at: application.naturalExpiresAt, key, applications: [] };
      expiryBuckets.set(key, bucket);
      // Sift the new instant up until its parent is no later.
      let index = expiryHeap.push(bucket) - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;

        if (expiryHeap[parent].key <= key) break;

        expiryHeap[index] = expiryHeap[parent];
        index = parent;
      }

      expiryHeap[index] = bucket;
    }

    bucket.applications.push(application);
  }

  /** Drop the earliest indexed instant and restore heap order from the root. */
  function discardEarliestExpiry(): void {
    expiryBuckets.delete(expiryHeap[0].key);
    const last = expiryHeap.pop()!;

    if (!expiryHeap.length) return;

    let index = 0;
    for (;;) {
      let child = index * 2 + 1;

      if (child >= expiryHeap.length) break;

      if (child + 1 < expiryHeap.length && expiryHeap[child + 1].key < expiryHeap[child].key) child += 1;

      if (expiryHeap[child].key >= last.key) break;

      expiryHeap[index] = expiryHeap[child];
      index = child;
    }

    expiryHeap[index] = last;
  }

  /** The next expiry that still has a live application; passed and fully removed instants leave the index for good. */
  function nextLiveExpiry(after: number): number | undefined {
    while (expiryHeap.length) {
      const bucket = expiryHeap[0];

      // Removal is permanent, so an instant whose applications are all removed can never need a sample again.
      if (bucket.at > after && bucket.applications.some((application) => !isRemoved(application, after)))
        return bucket.at;

      discardEarliestExpiry();
    }

    return undefined;
  }

  /** Maintain one effective owner/condition wake on the target clock; expiry remainders wait for that pulse. */
  function scheduleGroup(ctx: Gw2ResolverRuntime, group: Gw2ResolverConditionGroup): void {
    if (!group.applications.length) {
      ctx.conditionState.get(group.condition)?.groups?.delete(group.owner);
      group.wakeToken += 1;
      group.wakeAt = null;
      return;
    }

    const at = group.nextPulseAt;

    if (group.wakeAt === at) return;

    group.wakeAt = at;
    group.wakeToken += 1;

    if (ctx.horizon != null && at > ctx.horizon) return;

    // Shared pulses have no application causal order. Restore inheritance for other derived events.
    const causalOrder = ctx.queue.currentCausalOrder;
    ctx.queue.currentCausalOrder = null;
    try {
      ctx.queue.enqueue({
        type: 'condition_tick',
        at,
        source: 'Condition',
        sourceId: `condition.${group.condition.toLowerCase()}`,
        actorType: ACTOR.EFFECT,
        condition: group.condition,
        conditionGroup: group,
        wakeToken: group.wakeToken
      });
    } finally {
      ctx.queue.currentCausalOrder = causalOrder;
    }
  }

  /** Sample at whole-second pulses and exact expirations, without stepping through intervening milliseconds. */
  function scheduleBuffer(ctx: Gw2ResolverRuntime, after: number, newExpiresAt?: number): void {
    let at = nextPulseAt(ctx, after);
    let active = ctx.environmentConditions.size > 0;

    if (newExpiresAt !== undefined) {
      // Existing applications already have a queued sample; only the new expiry can bring it forward.
      at = Math.min(at, newExpiresAt);
      active = true;
    } else {
      // After a sample, the expiry index supplies both continued work and the next expiry without rescanning owners.
      const expiry = nextLiveExpiry(after);

      if (expiry !== undefined) {
        active = true;
        at = Math.min(at, expiry);
      }
    }

    if (
      !active ||
      (ctx.conditionBufferAt != null && ctx.conditionBufferAt <= at) ||
      (ctx.horizon != null && at > ctx.horizon)
    )
      return;

    if (bufferWake && bufferWake.at > after) ctx.queue.cancel(bufferWake);

    ctx.conditionBufferAt = at;
    const causalOrder = ctx.queue.currentCausalOrder;
    ctx.queue.currentCausalOrder = null;
    try {
      bufferWake = ctx.queue.enqueue({
        type: 'condition_buffer',
        at,
        source: 'Condition',
        sourceId: 'condition.buffer',
        actorType: ACTOR.EFFECT
      });
    } finally {
      ctx.queue.currentCausalOrder = causalOrder;
    }
  }

  /** Sample every owner before any whole-second payout; never retroactively query earlier mutable state. */
  function bufferConditions(ctx: Gw2ResolverRuntime, at: number): void {
    if (ctx.conditionBufferedAt != null && at <= ctx.conditionBufferedAt) return;

    ctx.conditionBufferedAt = at;
    const onGrid = (timeKey(at) - timeKey(ctx.firstHitTime ?? 0)) % 1_000_000 === 0;
    // Each pass observes one target state; discard these facts before processing another event or timestamp.
    const sample = {
      vulnerabilityStacks: ctx.query.vulnerabilityStacksAt(at, ctx),
      modifierValues: new Map<object, number | null>()
    };
    // Reuse only within this observation pass; later state changes always get a fresh attribute sample.
    let conditionDamageByBatch: Map<object, number> | undefined;
    /** Settle one application through this pass, buffering its damage for its owner's whole-second payout. */
    const settle = (application: Gw2ResolvedConditionApplication): void => {
      if (isRemoved(application, at)) return;

      // An application always carries its owner group's canonical condition name.
      const condition = application.condition;
      // Optional trait damage belongs to the accepted application; ordinary conditions use their shared formula.
      const formula = application.conditionDamageFormula;
      const dealsDamage = formula != null || Object.hasOwn(CONDITION_FORMULAS, condition);
      const through = Math.min(at, application.naturalExpiresAt);
      const elapsedUs = timeKey(through) - timeKey(application.settledThrough);

      // Expiry remainders sampled before Combat Start cannot fund a later in-combat payout.
      if (elapsedUs > 0 && ctx.engagement.hostileEffectsAllowed(at)) {
        // Non-damaging conditions still settle and remain queryable; only their zero-damage arithmetic is skipped.
        if (dealsDamage) {
          const batch = attributeBatches.get(application);
          let conditionDamage = batch ? conditionDamageByBatch?.get(batch) : undefined;

          if (conditionDamage === undefined) {
            conditionDamage = ctx.query.statsAt(at, application, ctx).conditionDamage;

            if (batch) {
              conditionDamageByBatch ??= new Map();
              conditionDamageByBatch.set(batch, conditionDamage);
            }
          }

          // The first damaging sample of a diagnostic application records its rate and traced multiplier.
          const calculation = application.conditionCalculation;
          const damageContributors: Gw2ModifierContribution[] | undefined =
            calculation && calculation.multiplier == null ? [] : undefined;
          const rate = formula
            ? formula.base + formula.scaling * conditionDamage
            : conditionRate(ctx, condition, conditionDamage);
          const multiplier = ctx.query.conditionMultiplier(condition, at, application, ctx, sample, damageContributors);

          if (calculation && damageContributors) {
            calculation.conditionDamage = conditionDamage;
            calculation.rate = rate;
            calculation.multiplier = multiplier;
            calculation.damageContributors = damageContributors;
          }

          // Retain every contribution, including expiry remainders, for one owner/condition rounding at payout.
          const rawDamage = rate * multiplier * (elapsedUs / 1_000_000) * application.stacks;
          application.bufferedRawDamage += rawDamage;
        }

        application.bufferedDurationUs += elapsedUs;
      }

      application.settledThrough = through;
    };

    if (onGrid) {
      for (const state of ctx.conditionState.values())
        for (const group of state.groups?.values() ?? [])
          for (const application of group.applications) settle(application);
    } else {
      // An off-grid expiry samples only its own tail; other applications retain their regular sampling times.
      // The expiry index names exactly those applications, so the pass visits no other owner.
      for (const application of expiryBuckets.get(timeKey(at))?.applications ?? [])
        if (application.naturalExpiresAt === at) settle(application);
    }

    for (const entry of ctx.environmentConditions.values()) {
      if (!onGrid) continue;

      // The sample ending at Combat Start contains no in-combat interval and must not fund a boundary payout.
      if (!ctx.engagement.hostileEffectsAllowed(at, false)) {
        entry.bufferedRate = 0;
        continue;
      }

      const vulnerability = 1 + (sample.vulnerabilityStacks || 0) / 100;
      entry.bufferedRate = (entry.bufferedRate ?? 0) + conditionTickDamage(entry.name, 0) * vulnerability;
    }
  }

  function handleConditionBuffer(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
    // An earlier expiry can replace a queued pulse sampler; obsolete entries must not sample twice.
    if (event.at !== ctx.conditionBufferAt) return;

    ctx.conditionBufferAt = undefined;
    bufferConditions(ctx, event.at);
    // Natural expiry stops sampling, while the owner wake retains its buffered remainder until payout.
    scheduleBuffer(ctx, event.at);
  }

  function applyCondition(ctx: Gw2ResolverRuntime, event: SimulationEventBase): Gw2ResolvedConditionApplication[] {
    // Synchronous reaction applications bypass enqueue, so normalize before querying or inserting live state.
    event = canonicalEvent(event);

    if (ctx.queue.currentTime != null && event.at < ctx.queue.currentTime) {
      throw new RangeError(`Cannot apply a condition in the past at ${event.at}s from ${String(event.sourceId)}.`);
    }

    const name = ctx.helpers.conditionName(event.condition);
    const queryEvent = event as unknown as Gw2ResolverEvent;
    // Duration is snapshotted at application time. Damage stats and multipliers
    // are deliberately queried later at each tick.
    // Diagnostics capture this application's own duration facts; ordinary runs pass no trace.
    const durationTrace: Gw2ConditionDurationTrace | undefined = ctx.damageDiagnostics
      ? { durationContributors: [] }
      : undefined;
    const duration = conditionApplicationDuration(ctx.query, name, queryEvent, ctx, durationTrace);
    const expiresAt = canonicalTime(event.at + duration);
    const stacks = Math.max(0, event.stacks || 0);

    if (!Number.isFinite(stacks)) throw new RangeError('Condition stacks must be finite.');

    if (!stacks || !duration) return [];

    // Reserve every stack before inserting state or firing reactions, preserving a fractional final stack.
    const stackCount = Math.ceil(stacks);
    expansionBudget.reserve(stackCount, `condition=${name} source=${event.sourceId}`);
    // Every producer shares per-stack reactions; create applications directly without an intermediate packet array.
    // Preserve fractional weight on the final stack and dispatch before inserting the next one.
    const applications: Gw2ResolvedConditionApplication[] = [];
    // A cache pays only when at least two equal-weight siblings can reuse the sample.
    const attributeBatch = stacks >= 2 ? {} : undefined;
    for (let index = 0; index < stackCount; index += 1) {
      const application = {
        ...event,
        sourceId: event.sourceId,
        name: event.name || `${event.skillName || event.sourceId || 'Condition'} — ${name}`,
        condition: name,
        stacks: Math.min(1, stacks - index),
        effectiveDuration: duration,
        // Keep the natural lifetime while executing; result finalization clips only the presentation fields.
        activeDuration: duration,
        expiresAt,
        naturalExpiresAt: expiresAt,
        settledThrough: event.at,
        bufferedRawDamage: 0,
        bufferedDurationUs: 0,
        damage: 0,
        damagingStackSeconds: 0,
        damageTicks: [],
        ...(durationTrace
          ? {
              conditionCalculation: {
                baseDuration: Math.max(0, event.duration || 0),
                baseDurationMultiplier: durationTrace.baseDurationMultiplier ?? 1,
                durationMultiplier: durationTrace.durationMultiplier ?? 1,
                durationContributors: durationTrace.durationContributors
              }
            }
          : {})
      } as Gw2ResolvedConditionApplication;

      if (attributeBatch && application.stacks === 1) attributeBatches.set(application, attributeBatch);

      if (ctx.reporting) ctx.resolved.push(application);

      // Canonical stacks retain applications for live queries and queued-tick cancellation in both output modes.
      const state = ensureConditionState(ctx, name);
      state.stacks.push({
        appliedAt: event.at,
        // Stack queries use natural expiry. The resolver horizon only limits
        // scheduled damage, not the semantic duration of the application.
        expiresAt,
        weight: application.stacks,
        application
      });
      // Accepted applications invalidate report windows without involving later damage settlement.
      reviseEffectState(state);
      const groups = (state.groups ??= new Map());
      const owner = damageOwner(application);
      let group = groups.get(owner);

      if (group) {
        pruneGroup(group, event.at);

        if (!group.applications.length) {
          scheduleGroup(ctx, group);
          group = undefined;
        }
      }

      if (!group) {
        // New applications join the first-damage clock, even after the target had no active conditions.
        group = {
          owner,
          condition: name,
          nextPulseAt: nextPulseAt(ctx, event.at),
          wakeToken: 0,
          wakeAt: null,
          applications: []
        };
        groups.set(owner, group);
      }

      group.applications.push(application);
      indexExpiry(application);
      scheduleBuffer(ctx, event.at, expiresAt);
      scheduleGroup(ctx, group);

      reactions.dispatch('condition.applied', ctx, application, {
        application,
        conditionStackIndex: index + 1,
        activeConditionStackCount
      });
      applications.push(application);
    }

    return applications;
  }

  /** Round the complete owner/condition packet once, then attribute integer shares without changing its total. */
  function handleConditionTick(ctx: Gw2ResolverRuntime, event: Gw2ConditionWorkEvent): Gw2ConditionTickResult | null {
    const group = event.conditionGroup;

    if (!group || event.wakeToken !== group.wakeToken || group.wakeAt == null) return null;

    group.wakeAt = null;
    bufferConditions(ctx, event.at);
    pruneGroup(group, event.at);
    group.nextPulseAt = canonicalTime(event.at + 1);
    const canDamage = ctx.engagement.hostileEffectsAllowed(event.at);
    const contributions = [];
    for (const application of group.applications) {
      const fraction = application.bufferedDurationUs / 1_000_000;
      const rawDamage = application.bufferedRawDamage;
      application.bufferedRawDamage = 0;
      application.bufferedDurationUs = 0;

      // Precombat packets are discarded; payout never resamples stats or invents a catch-up hit.
      if (!canDamage || fraction <= 0) continue;

      const stackSeconds = application.stacks * fraction;
      contributions.push({ application, fraction, stackSeconds, rawDamage, damage: Math.floor(rawDamage) });
    }

    const damage = roundHalfToEven(contributions.reduce((total, contribution) => total + contribution.rawDamage, 0));
    const remainder = damage - contributions.reduce((total, contribution) => total + contribution.damage, 0);
    // Largest fractional remainders receive the remaining points; stable application order resolves ties.
    const ranked = [...contributions].sort((a, b) => b.rawDamage - b.damage - (a.rawDamage - a.damage));
    for (let index = 0; index < remainder; index += 1) ranked[index].damage += 1;
    for (const contribution of contributions) {
      const { application, fraction, stackSeconds, damage: share } = contribution;
      application.damage += share;
      application.damagingStackSeconds += stackSeconds;

      if (ctx.reporting) application.damageTicks.push({ at: event.at, damage: share, fraction });

      ctx.addBreakdown(application.name, share, 'conditionDamage', 0, application);
    }

    if (contributions.length) {
      ctx.totals.condition += damage;
      const entry = ctx.conditions.get(group.condition) || { name: group.condition, damage: 0, stackSeconds: 0 };
      entry.damage += damage;
      entry.stackSeconds += contributions.reduce((total, contribution) => total + contribution.stackSeconds, 0);
      ctx.conditions.set(group.condition, entry);

      if (damage > 0) ctx.markDamageTime(event.at);
    }

    pruneGroup(group, event.at);
    scheduleGroup(ctx, group);
    return contributions.length ? { condition: group.condition, damage, contributions } : null;
  }

  /** Applies only the condition's base formula and target Vulnerability, never player-owned outgoing effects. */
  function handleEnvironmentConditionTick(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
    // Provisional environment wakes become inert when first damage shifts the clock.
    if ((timeKey(event.at) - timeKey(ctx.firstHitTime ?? 0)) % 1_000_000 !== 0) return;

    const condition = ctx.helpers.conditionName(event.condition);
    const stacks = Math.max(0, event.stacks || 0);
    const entry = ctx.environmentConditions.get(condition);

    if (!entry || !(stacks > 0)) return;

    environmentWakes.delete(condition);
    // Each paid or gated pulse advances only its own successor; other conditions retain stable insertion order.
    const next = nextPulseAt(ctx, event.at);

    if (ctx.horizon == null || next <= ctx.horizon) {
      environmentWakes.set(condition, ctx.queue.enqueue({ ...event, at: next }));
    }

    bufferConditions(ctx, event.at);
    const damage = roundHalfToEven((entry.bufferedRate ?? 0) * stacks);
    entry.bufferedRate = 0;

    if (!(damage > 0)) return;

    ctx.environmentDamage += damage;
    entry.damage += damage;
    entry.stackSeconds += stacks;

    if (ctx.reporting) entry.damageTicks.push({ at: event.at, damage });
  }

  return Object.freeze({
    activeConditionStackCount,
    applyCondition,
    handleConditionTick,
    handleConditionBuffer,
    startDamageClock,
    initializeEnvironment,
    handleEnvironmentConditionTick
  });
}

/** Condition application, owner-clock, and damage-allocation records retained by the condition resolver. */

export type Gw2ResolvedConditionApplication = Gw2ResolverEvent & {
  readonly name: string;
  readonly condition: string;
  readonly stacks: number;
  readonly effectiveDuration: number;
  activeDuration: number;
  expiresAt: number;
  readonly naturalExpiresAt: number;
  removedAt?: number;
  settledThrough: number;
  bufferedRawDamage: number;
  bufferedDurationUs: number;
  damage: number;
  damagingStackSeconds: number;
  /** Present only in diagnostic runs. */
  conditionCalculation?: Gw2ConditionCalculation;
  readonly damageTicks: Array<{
    at: number;
    damage: number;
    fraction: number;
  }>;
};

interface Gw2ResolverConditionStack extends Gw2RuntimeConditionStack {
  appliedAt: number;
  expiresAt: number;
  weight: number;
  application: Gw2ResolvedConditionApplication;
}

export interface Gw2ResolverConditionState extends Gw2RuntimeConditionEntry {
  stacks: Gw2ResolverConditionStack[];
  groups?: Map<string | Gw2ResolvedConditionApplication, Gw2ResolverConditionGroup>;
}

/** Owner clocks reference canonical applications so removal and reporting share the same lifetime. */
interface Gw2ResolverConditionGroup {
  readonly owner: string | Gw2ResolvedConditionApplication;
  readonly condition: string;
  nextPulseAt: number;
  wakeToken: number;
  wakeAt: number | null;
  applications: Gw2ResolvedConditionApplication[];
}

/** Every application sharing one natural expiry instant, ordered in the sampler's heap by its microsecond key. */
interface Gw2ConditionExpiryBucket {
  readonly at: number;
  readonly key: number;
  readonly applications: Gw2ResolvedConditionApplication[];
}

/** Retains each application's exposure and damage for packet rounding and attribution. */
interface Gw2ConditionTickContribution {
  readonly application: Gw2ResolvedConditionApplication;
  readonly damage: number;
  readonly rawDamage: number;
  readonly fraction: number;
  readonly stackSeconds: number;
}

/** An atomic owner packet rounds once and retains each application's raw contribution and allocated integer share. */
interface Gw2ConditionTickResult {
  readonly condition: string;
  readonly damage: number;
  readonly contributions: readonly Gw2ConditionTickContribution[];
}

export interface Gw2ConditionResolution {
  activeConditionStackCount(context: Gw2ResolverRuntime, name: string, at: number): number;
  applyCondition(context: Gw2ResolverRuntime, event: SimulationEventBase): Gw2ResolvedConditionApplication[];
  handleConditionTick(context: Gw2ResolverRuntime, event: Gw2ConditionWorkEvent): Gw2ConditionTickResult | null;
  handleConditionBuffer(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void;
  initializeEnvironment(context: Gw2ResolverRuntime): void;
  startDamageClock(context: Gw2ResolverRuntime): void;
  handleEnvironmentConditionTick(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void;
}

/** Resolver-private references never belong to the persisted or worker event payload contract. */
export interface Gw2ConditionWork {
  readonly application?: Gw2ResolvedConditionApplication;
  readonly conditionGroup?: Gw2ResolverConditionGroup;
  readonly wakeToken?: number;
}
