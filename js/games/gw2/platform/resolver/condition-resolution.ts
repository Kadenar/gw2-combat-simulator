import { EPSILON } from '#kernel/core/clock.js';
import { conditionTickDamage } from '#gw2/platform/combat/damage/condition-formulas.js';
import { conditionApplicationDuration } from '#gw2/platform/combat/query/condition-duration.js';
import { roundHalfToEven } from '#gw2/platform/combat/numeric.js';
import { GW2_EVENT_ACTOR_TYPES } from '#gw2/platform/combat/state/event-ownership.js';
import {
  CANONICAL_TARGET_CONDITIONS,
  createPermanentTargetConditionStacks,
  GW2_DAMAGING_CONDITIONS
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
  const hasPermanentConditions = CANONICAL_TARGET_CONDITIONS.some((name) => permanentTargetConditionStacks(name) > 0);
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
    // Console conditions, including non-damaging ones, anchor and sustain the target's shared timer.
    if (hasPermanentConditions) ctx.conditionClock = { anchor: startsAt, groups: new Set() };
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
  }

  /** Player effects share player damage; modifier inheritance never merges independent summons. */
  function damageOwner(application: Gw2ResolvedConditionApplication): string | Gw2ResolvedConditionApplication {
    if (
      application.actorType === 'player' ||
      (application.actorType === 'effect' && application.ownerActorType === 'player')
    )
      return 'player';
    if (application.actorType === 'summon' && application.summonOwner) return `summon:${application.summonOwner}`;
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
        !isRemoved(application, at) && application.settledThrough < application.naturalExpiresAt - EPSILON
    );
  }

  /** Maintain one effective owner/condition wake on the target clock; expiry remainders wait for that pulse. */
  function scheduleGroup(ctx: Gw2ResolverRuntime, group: Gw2ResolverConditionGroup): void {
    if (!group.applications.length) {
      ctx.conditionState.get(group.condition)?.groups?.delete(group.owner);
      ctx.conditionClock?.groups.delete(group);
      if (!hasPermanentConditions && ctx.conditionClock?.groups.size === 0) ctx.conditionClock = undefined;
      group.wakeToken += 1;
      group.wakeAt = null;
      return;
    }

    const at = group.anchor + group.pulseIndex;
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
    // A forced removal can empty another owner before its queued wake; do not inherit that dead clock.
    for (const pending of ctx.conditionClock?.groups ?? []) {
      pruneGroup(pending, event.at);
      if (!pending.applications.length) scheduleGroup(ctx, pending);
    }

    const groups = (state.groups ??= new Map());
    const owner = damageOwner(application);
    let group = groups.get(owner);
    if (!group) {
      // An empty gap starts a fresh cadence, including gaps caused by forced removal.
      const clock = (ctx.conditionClock ??= { anchor: event.at, groups: new Set() });
      group = {
        owner,
        condition: name,
        anchor: clock.anchor,
        pulseIndex: Math.floor(Math.max(0, event.at - clock.anchor) + EPSILON) + 1,
        wakeToken: 0,
        wakeAt: null,
        applications: []
      };
      groups.set(owner, group);
      clock.groups.add(group);
    }

    group.applications.push(application);
    scheduleGroup(ctx, group);

    reactions.dispatch('condition.applied', ctx, application, {
      application,
      activeConditionStackCount
    });
    return application;
  }

  /** Resolve a shared packet against one pre-packet state, then allocate its rounded total for reporting. */
  function handleConditionTick(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2ConditionTickResult | null {
    const group = event.conditionGroup;
    if (!group || event.wakeToken !== group.wakeToken || group.wakeAt == null) return null;
    group.wakeAt = null;
    pruneGroup(group, event.at);
    group.pulseIndex += 1;
    const canDamage = ctx.combatStartTime == null || event.at >= ctx.combatStartTime - EPSILON;
    const contributions = [];
    for (const application of group.applications) {
      const through = Math.min(event.at, application.naturalExpiresAt);
      // Remove subtraction noise without rounding split intervals to the 40ms duration grid.
      const fraction = Math.max(0, Math.round((through - application.settledThrough) * 1e12) / 1e12);
      application.settledThrough = through;
      // Precombat wakes advance settlement and cadence without accumulating a catch-up hit.
      if (!canDamage || fraction <= EPSILON) continue;
      const stats = ctx.query.statsAt(event.at, application, ctx);
      const perStack =
        conditionRate(ctx, group.condition, stats.conditionDamage) *
        ctx.query.conditionMultiplier(group.condition, event.at, application, ctx);
      const stackSeconds = application.stacks * fraction;
      const rawDamage = perStack * stackSeconds;
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
      if (damage > 0) ctx.markDamageTime(event.at);
    }

    pruneGroup(group, event.at);
    scheduleGroup(ctx, group);
    return contributions.length ? { condition: group.condition, damage, contributions } : null;
  }

  /** Applies only the condition's base formula and target Vulnerability, never player-owned outgoing effects. */
  function handleEnvironmentConditionTick(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
    const condition = ctx.helpers.conditionName(event.condition);
    const stacks = Math.max(0, Number(event.stacks || 0));
    const entry = ctx.environmentConditions.get(condition);
    if (!entry || !(stacks > 0)) return;

    // Permanent training conditions have zero Condition Damage. Confusion is
    // passive-only, while conditionTickDamage keeps Torment stationary here.
    const vulnerabilityMultiplier = 1 + Number(ctx.query.vulnerabilityStacksAt(event.at, ctx) || 0) / 100;
    const damage = roundHalfToEven(conditionTickDamage(condition, 0) * stacks * vulnerabilityMultiplier);
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
    initializeEnvironment,
    handleEnvironmentConditionTick
  });
}
