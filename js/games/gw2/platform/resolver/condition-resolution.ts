import { EPSILON } from '#kernel/core/clock.js';
import { conditionTickDamage } from '#gw2/platform/combat/damage/condition-formulas.js';
import { conditionApplicationDuration } from '#gw2/platform/combat/query/condition-duration.js';
import { roundHalfToEven } from '#gw2/platform/combat/numeric.js';
import { GW2_EVENT_ACTOR_TYPES } from '#gw2/platform/combat/state/event-ownership.js';
import {
  createPermanentTargetConditionStacks,
  GW2_DAMAGING_CONDITIONS,
  isDamagingCondition
} from '#gw2/platform/combat/state/targets.js';

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
  function activeStacks(ctx: Gw2ResolverRuntime, name: string, at: number): Gw2ResolverConditionStack[] {
    const state = ctx.conditionState.get(name);
    if (!state) return [];
    // Expiry is half-open: a stack is active before expiresAt, not at it.
    return state.stacks.filter(
      (stack) => stack.appliedAt <= at + EPSILON && stack.expiresAt > at + EPSILON && stack.weight > 0
    );
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
    const startsAt = 0;
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
      for (let at = startsAt + 1; at <= ctx.horizon + EPSILON; at += 1) {
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

    if (ctx.environmentConditions.size) scheduleBuffer(ctx, 0);
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
    return application.removedAt != null && application.removedAt <= at + EPSILON;
  }

  /** Keep only unsettled, uncancelled applications so wake scans never grow with encounter history. */
  function pruneGroup(group: Gw2ResolverConditionGroup, at: number): void {
    group.applications = group.applications.filter(
      (application) =>
        !isRemoved(application, at) &&
        (application.bufferedSteps > 0 || application.settledThrough < application.naturalExpiresAt - EPSILON)
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
    if (group.wakeAt != null && Math.abs(group.wakeAt - at) <= EPSILON) return;
    group.wakeAt = at;
    group.wakeToken += 1;
    if (at > ctx.horizon + EPSILON) return;
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

  /** Queue one target-wide 40ms sampler so mutable combat state is observed before it changes again. */
  function scheduleBuffer(ctx: Gw2ResolverRuntime, after: number): void {
    const origin = ctx.firstHitTime ?? 0;
    const at = origin + (Math.floor((after - origin) * 25 + EPSILON) + 1) / 25;
    if (ctx.conditionBufferAt != null || at > ctx.horizon + EPSILON) return;
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
    if (ctx.conditionBufferedAt != null && at <= ctx.conditionBufferedAt + EPSILON) return;
    ctx.conditionBufferedAt = at;
    const origin = ctx.firstHitTime ?? 0;
    const step = Math.round((at - origin) * 25);
    // Each pass observes one target state; discard these facts before processing another event or timestamp.
    const sample = {
      vulnerabilityStacks: ctx.query.vulnerabilityStacksAt?.(at, ctx) ?? 0,
      modifierValues: new Map<object, number | null>()
    };
    for (const state of ctx.conditionState.values()) {
      for (const group of state.groups?.values() ?? []) {
        const dealsDamage = isDamagingCondition(group.condition);
        for (const application of group.applications) {
          if (isRemoved(application, at)) continue;
          if (
            step > Math.floor((application.settledThrough - origin) * 25 + EPSILON) &&
            step <= Math.floor((application.naturalExpiresAt - origin) * 25 + EPSILON)
          ) {
            // Non-damaging conditions still settle and remain queryable; only their zero-damage arithmetic is skipped.
            if (dealsDamage) {
              const stats = ctx.query.statsAt(at, application, ctx);
              // Sum rates before dividing by 25 to avoid accumulating repeated 0.04 multiplication noise.
              application.bufferedRate +=
                conditionRate(ctx, group.condition, stats.conditionDamage) *
                ctx.query.conditionMultiplier(group.condition, at, application, ctx, sample);
            }

            application.bufferedSteps += 1;
          }

          application.settledThrough = Math.min(at, application.naturalExpiresAt);
        }
      }
    }

    for (const entry of ctx.environmentConditions.values()) {
      const vulnerability = 1 + Number(sample.vulnerabilityStacks || 0) / 100;
      entry.bufferedRate = (entry.bufferedRate ?? 0) + conditionTickDamage(entry.name, 0) * vulnerability;
      // Environment payout events are combat-gated by the event loop; discard their precombat packets here.
      if (step % 25 === 0 && ctx.combatStartTime != null && at < ctx.combatStartTime - EPSILON) entry.bufferedRate = 0;
    }
  }

  function handleConditionBuffer(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
    // A first hit can replace the provisional sampler; obsolete queue entries must not sample twice.
    if (ctx.conditionBufferAt == null || Math.abs(event.at - ctx.conditionBufferAt) > EPSILON) return;
    ctx.conditionBufferAt = undefined;
    bufferConditions(ctx, event.at);
    const origin = ctx.firstHitTime ?? 0;
    const step = Math.round((event.at - origin) * 25);
    // Natural expiry stops sampling, while the owner wake retains its buffered remainder until payout.
    const active =
      ctx.environmentConditions.size > 0 ||
      [...ctx.conditionState.values()].some((state) =>
        [...(state.groups?.values() ?? [])].some((group) =>
          group.applications.some(
            (application) =>
              !isRemoved(application, event.at) &&
              Math.floor((application.naturalExpiresAt - origin) * 25 + EPSILON) > step
          )
        )
      );
    if (active) scheduleBuffer(ctx, event.at);
  }

  /** First damage fixes the phase for the rest of the fight, including empty gaps and every condition owner. */
  function anchorClock(ctx: Gw2ResolverRuntime, at: number): void {
    ctx.conditionBufferAt = undefined;
    ctx.conditionBufferedAt = at;
    for (const state of ctx.conditionState.values()) {
      for (const group of state.groups?.values() ?? []) {
        // Pre-fight samples do not belong to the new clock; surviving stacks begin accruing from first damage.
        for (const application of group.applications) {
          application.bufferedRate = 0;
          application.bufferedSteps = 0;
          application.settledThrough = Math.min(at, application.naturalExpiresAt);
        }

        pruneGroup(group, at);
        group.nextPulseAt = at + 1;
        scheduleGroup(ctx, group);
      }
    }

    for (const entry of ctx.environmentConditions.values()) entry.bufferedRate = 0;
    if (ctx.environmentConditions.size || [...ctx.conditionState.values()].some((state) => state.groups?.size))
      scheduleBuffer(ctx, at);
  }

  function applyCondition(ctx: Gw2ResolverRuntime, event: Gw2EventDraft): Gw2ResolvedConditionApplication | null {
    const name = ctx.helpers.conditionName(event.condition);
    const queryEvent = event as unknown as Gw2ResolverEvent;
    // Duration is snapshotted at application time. Damage stats and multipliers
    // are deliberately queried later at each tick.
    const duration = conditionApplicationDuration(ctx.query, name, queryEvent, ctx);
    const expiresAt = event.at + duration;
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
      bufferedRate: 0,
      bufferedSteps: 0,
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
      // Empty gaps stop queued work without resetting the first-damage clock.
      const origin = ctx.firstHitTime ?? 0;
      group = {
        owner,
        condition: name,
        nextPulseAt: origin + Math.floor(event.at - origin + EPSILON) + 1,
        wakeToken: 0,
        wakeAt: null,
        applications: []
      };
      groups.set(owner, group);
    }

    group.applications.push(application);
    scheduleBuffer(ctx, event.at);
    scheduleGroup(ctx, group);

    reactions.dispatch('condition.applied', ctx, application, {
      application,
      activeConditionStackCount
    });
    // Blind consumers observe the successful condition application exactly once.
    if (name === 'Blinded') reactions.dispatch('blind.resolved', ctx, application);
    return application;
  }

  /** Commit already sampled damage as one rounded packet, then allocate integer shares for reporting. */
  function handleConditionTick(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2ConditionTickResult | null {
    const group = event.conditionGroup;
    if (!group || event.wakeToken !== group.wakeToken || group.wakeAt == null) return null;
    group.wakeAt = null;
    bufferConditions(ctx, event.at);
    pruneGroup(group, event.at);
    group.nextPulseAt += 1;
    const canDamage = ctx.combatStartTime == null || event.at >= ctx.combatStartTime - EPSILON;
    const contributions = [];
    for (const application of group.applications) {
      const fraction = application.bufferedSteps / 25;
      const rawDamage = (application.bufferedRate * application.stacks) / 25;
      application.bufferedRate = 0;
      application.bufferedSteps = 0;
      // Precombat packets are discarded; payout never resamples stats or invents a catch-up hit.
      if (!canDamage || fraction <= EPSILON) continue;
      const stackSeconds = application.stacks * fraction;
      const perStack = rawDamage / stackSeconds;
      contributions.push({ application, fraction, perStack, stackSeconds, rawDamage, damage: Math.floor(rawDamage) });
    }

    const damage = roundHalfToEven(contributions.reduce((total, contribution) => total + contribution.rawDamage, 0));
    const remainder = damage - contributions.reduce((total, contribution) => total + contribution.damage, 0);
    // Stable sorting breaks equal fractional remainders by application order.
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
      if (damage > 0) ctx.markDamageTime(event.at, true);
    }

    pruneGroup(group, event.at);
    scheduleGroup(ctx, group);
    return contributions.length ? { condition: group.condition, damage, contributions } : null;
  }

  /** Applies only the condition's base formula and target Vulnerability, never player-owned outgoing effects. */
  function handleEnvironmentConditionTick(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
    // Permanent conditions were queued before first damage was known; move each wake onto the same fight phase.
    const origin = ctx.firstHitTime ?? 0;
    const elapsed = event.at - origin;
    if (Math.abs(elapsed - Math.round(elapsed)) > EPSILON) {
      ctx.queue.enqueue({ ...event, at: origin + Math.floor(elapsed + EPSILON) + 1 });
      return;
    }

    const condition = ctx.helpers.conditionName(event.condition);
    const stacks = Math.max(0, Number(event.stacks || 0));
    const entry = ctx.environmentConditions.get(condition);
    if (!entry || !(stacks > 0)) return;

    bufferConditions(ctx, event.at);
    const damage = roundHalfToEven(((entry.bufferedRate ?? 0) * stacks) / 25);
    entry.bufferedRate = 0;
    if (!(damage > 0)) return;

    ctx.environmentDamage += damage;
    entry.damage += damage;
    entry.stackSeconds += stacks;
    if (ctx.reporting) entry.damageTicks.push({ at: event.at, damage });
  }

  return Object.freeze({
    anchorClock,
    activeConditionStackCount,
    applyCondition,
    handleConditionTick,
    handleConditionBuffer,
    initializeEnvironment,
    handleEnvironmentConditionTick
  });
}
