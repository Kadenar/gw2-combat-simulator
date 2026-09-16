import { canonicalTime, isTimeInWindow, timeKey } from '#kernel/core/clock.js';
import { canonicalEvent } from '#kernel/events/queue.js';
import { CONDITION_FORMULAS, conditionTickDamage } from '#gw2/platform/combat/damage/condition-formulas.js';
import { conditionApplicationDuration } from '#gw2/platform/combat/query/condition-duration.js';
import { roundHalfToEven } from '#gw2/platform/combat/numeric.js';
import { GW2_EVENT_ACTOR_TYPES } from '#gw2/platform/combat/state/event-ownership.js';
import { createPermanentTargetConditionStacks, GW2_DAMAGING_CONDITIONS } from '#gw2/platform/combat/state/targets.js';

import type {
  Gw2ConditionResolution,
  Gw2ConditionTickResult,
  Gw2ResolvedConditionApplication,
  Gw2ResolverConditionGroup,
  Gw2ResolverConditionStack,
  Gw2ResolverConditionState,
  Gw2ResolverEvent,
  Gw2ResolverReactionRegistry,
  Gw2ResolverRuntime
} from '#gw2/platform/resolver/types.js';
import type { Gw2EventDraft } from '#gw2/platform/equipment/relics/types.js';

interface CreateGw2ConditionResolutionOptions {
  readonly reactions: Gw2ResolverReactionRegistry;
  readonly config?: Gw2ResolverRuntime['config'];
}

const MOVING_TORMENT = Object.freeze({ base: 22, scaling: 0.06 });
const CONFUSION_ACTIVATION = Object.freeze({ base: 16.24, scaling: 0.0325 });

/**
 * Creates timestamp-aware condition resolution shared by GW2 professions.
 * Successful applications dispatch after state insertion and tick scheduling.
 */
export function createGw2ConditionResolution({
  reactions,
  config = {}
}: CreateGw2ConditionResolutionOptions): Readonly<Gw2ConditionResolution> {
  const permanentTargetConditionStacks = createPermanentTargetConditionStacks(config);

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
    return (
      permanentTargetConditionStacks(name) +
      activeStacks(ctx, name, at).reduce((total, stack) => total + stack.weight, 0)
    );
  }

  function conditionRate(ctx: Gw2ResolverRuntime, name: string, conditionDamage: number): number {
    // Torment switches formula entirely for a moving target. Confusion keeps
    // its passive tick and adds configured activation damage as an average rate.
    if (name === 'Torment' && ctx.config.target?.moving) {
      return MOVING_TORMENT.base + MOVING_TORMENT.scaling * conditionDamage;
    }

    let rate = conditionTickDamage(name, conditionDamage);
    if (name === 'Confusion') {
      rate +=
        Number(ctx.config.target?.confusionActivationsPerSecond || 0) *
        (CONFUSION_ACTIVATION.base + CONFUSION_ACTIVATION.scaling * conditionDamage);
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
      for (let at = nextPulseAt(ctx, after); at <= ctx.horizon; at = canonicalTime(at + 1)) {
        ctx.queue.enqueue({
          type: 'condition_tick',
          at,
          source: 'Environment',
          sourceId: `environment.target-condition.${condition.toLowerCase()}`,
          actorType: GW2_EVENT_ACTOR_TYPES.ENVIRONMENT,
          ownerActorType: GW2_EVENT_ACTOR_TYPES.ENVIRONMENT,
          condition,
          stacks,
          fraction: 1
        });
      }
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
    if (application.actorType === 'summon') {
      if (!application.independentConditionOwner) return 'player';
      return application.summonOwner ? `summon:${application.summonOwner}` : application;
    }

    if (
      application.actorType === 'player' ||
      (application.actorType === 'effect' && application.ownerActorType === 'player')
    )
      return 'player';
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
    if (at > ctx.horizon) return;
    // Shared pulses have no application causal order. Restore inheritance for other derived events.
    const causalOrder = ctx.queue.currentCausalOrder;
    ctx.queue.currentCausalOrder = null;
    try {
      ctx.queue.enqueue({
        type: 'condition_tick',
        at,
        source: 'Condition',
        sourceId: `condition.${group.condition.toLowerCase()}`,
        actorType: 'effect',
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
      // After a sample, find both continued work and the next expiry in one pass without temporary arrays.
      for (const state of ctx.conditionState.values()) {
        for (const group of state.groups?.values() ?? []) {
          for (const application of group.applications) {
            if (!isRemoved(application, after) && application.naturalExpiresAt > after) {
              active = true;
              at = Math.min(at, application.naturalExpiresAt);
            }
          }
        }
      }
    }

    if (!active || (ctx.conditionBufferAt != null && ctx.conditionBufferAt <= at) || at > ctx.horizon) return;
    ctx.conditionBufferAt = at;
    const causalOrder = ctx.queue.currentCausalOrder;
    ctx.queue.currentCausalOrder = null;
    try {
      ctx.queue.enqueue({
        type: 'condition_buffer',
        at,
        source: 'Condition',
        sourceId: 'condition.buffer',
        actorType: 'effect'
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
      vulnerabilityStacks: ctx.query.vulnerabilityStacksAt?.(at, ctx) ?? 0,
      modifierValues: new Map<object, number | null>()
    };
    for (const state of ctx.conditionState.values()) {
      for (const group of state.groups?.values() ?? []) {
        // Explicit applications may use trait-only formulas such as Terror's Fear outside the standard damaging subset.
        const dealsDamage = Object.hasOwn(CONDITION_FORMULAS, group.condition);
        for (const application of group.applications) {
          if (isRemoved(application, at)) continue;
          // An off-grid expiry samples only its own tail; other applications retain their regular sampling times.
          if (!onGrid && at !== application.naturalExpiresAt) continue;
          const through = Math.min(at, application.naturalExpiresAt);
          const elapsedUs = timeKey(through) - timeKey(application.settledThrough);
          // Expiry remainders sampled before Combat Start cannot fund a later in-combat payout.
          if (elapsedUs > 0 && (ctx.combatStartTime == null || at >= ctx.combatStartTime)) {
            // Non-damaging conditions still settle and remain queryable; only their zero-damage arithmetic is skipped.
            if (dealsDamage) {
              const stats = ctx.query.statsAt(at, application, ctx);
              // Retain every contribution, including expiry remainders, for one owner/condition rounding at payout.
              const rawDamage =
                conditionRate(ctx, group.condition, stats.conditionDamage) *
                ctx.query.conditionMultiplier(group.condition, at, application, ctx, sample) *
                (elapsedUs / 1_000_000) *
                application.stacks;
              application.bufferedRawDamage += rawDamage;
            }

            application.bufferedDurationUs += elapsedUs;
          }

          application.settledThrough = through;
        }
      }
    }

    for (const entry of ctx.environmentConditions.values()) {
      if (!onGrid) continue;
      // The sample ending at Combat Start contains no in-combat interval and must not fund a boundary payout.
      if (ctx.combatStartTime != null && at <= ctx.combatStartTime) {
        entry.bufferedRate = 0;
        continue;
      }

      const vulnerability = 1 + Number(sample.vulnerabilityStacks || 0) / 100;
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

  function applyCondition(ctx: Gw2ResolverRuntime, event: Gw2EventDraft): Gw2ResolvedConditionApplication | null {
    // Synchronous reaction applications bypass enqueue, so normalize before querying or inserting live state.
    event = canonicalEvent(event);
    if (ctx.queue.currentTime != null && event.at < ctx.queue.currentTime) {
      throw new RangeError(`Cannot apply a condition in the past at ${event.at}s from ${String(event.sourceId)}.`);
    }

    const name = ctx.helpers.conditionName(event.condition);
    const queryEvent = event as unknown as Gw2ResolverEvent;
    // Duration is snapshotted at application time. Damage stats and multipliers
    // are deliberately queried later at each tick.
    const duration = conditionApplicationDuration(ctx.query, name, queryEvent, ctx);
    const expiresAt = canonicalTime(event.at + duration);
    const stacks = Math.max(0, Number(event.stacks || 0));
    if (!stacks || !duration) return null;

    const application = {
      ...event,
      sourceId: event.sourceId ?? event.skillId ?? event.skillName ?? event.type,
      name: event.name || `${event.skillName || event.sourceId || 'Condition'} — ${name}`,
      condition: name,
      stacks,
      effectiveDuration: duration,
      // activeDuration/expiresAt describe the simulated portion; naturalExpiresAt
      // preserves the unclipped lifetime for diagnostics and downstream views.
      activeDuration: Math.max(0, Math.min(ctx.horizon, expiresAt) - event.at),
      expiresAt: Math.min(ctx.horizon, expiresAt),
      naturalExpiresAt: expiresAt,
      settledThrough: event.at,
      bufferedRawDamage: 0,
      bufferedDurationUs: 0,
      damage: 0,
      damagingStackSeconds: 0,
      damageTicks: []
    } as Gw2ResolvedConditionApplication;
    if (ctx.reporting) ctx.resolved.push(application);

    // Canonical stacks retain applications for live queries and queued-tick cancellation in both output modes.
    const state = ensureConditionState(ctx, name);
    state.stacks.push({
      appliedAt: event.at,
      // Stack queries use natural expiry. The resolver horizon only limits
      // scheduled damage, not the semantic duration of the application.
      expiresAt,
      weight: stacks,
      application
    });
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
    scheduleBuffer(ctx, event.at, expiresAt);
    scheduleGroup(ctx, group);

    reactions.dispatch('condition.applied', ctx, application, {
      application,
      activeConditionStackCount
    });
    // Blind consumers observe the successful condition application exactly once.
    if (name === 'Blinded') reactions.dispatch('blind.resolved', ctx, application);
    return application;
  }

  /** Round the complete owner/condition packet once, then attribute integer shares without changing its total. */
  function handleConditionTick(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2ConditionTickResult | null {
    const group = event.conditionGroup;
    if (!group || event.wakeToken !== group.wakeToken || group.wakeAt == null) return null;
    group.wakeAt = null;
    bufferConditions(ctx, event.at);
    pruneGroup(group, event.at);
    group.nextPulseAt = canonicalTime(event.at + 1);
    const canDamage = ctx.combatStartTime == null || event.at >= ctx.combatStartTime;
    const contributions = [];
    for (const application of group.applications) {
      const fraction = application.bufferedDurationUs / 1_000_000;
      const rawDamage = application.bufferedRawDamage;
      application.bufferedRawDamage = 0;
      application.bufferedDurationUs = 0;
      // Precombat packets are discarded; payout never resamples stats or invents a catch-up hit.
      if (!canDamage || fraction <= 0) continue;
      const stackSeconds = application.stacks * fraction;
      const perStack = rawDamage / stackSeconds;
      contributions.push({ application, fraction, perStack, stackSeconds, rawDamage, damage: Math.floor(rawDamage) });
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
    const stacks = Math.max(0, Number(event.stacks || 0));
    const entry = ctx.environmentConditions.get(condition);
    if (!entry || !(stacks > 0)) return;

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
