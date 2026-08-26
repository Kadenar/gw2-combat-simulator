import { EPSILON } from '../../engine/core/clock.js';
import { enqueueOrdered } from '../../engine/events/queue.js';
import { conditionTickDamage } from '../combat/damage/condition-formulas.js';
import { clamp } from '../combat/numeric.js';
import { createPermanentTargetConditionStacks } from '../combat/state/targets.js';

import type {
  Gw2ConditionResolution,
  Gw2ConditionTickResult,
  Gw2ResolvedConditionApplication,
  Gw2ResolverConditionStack,
  Gw2ResolverConditionState,
  Gw2ResolverEvent,
  Gw2ResolverReactionRegistry,
  Gw2ResolverRuntime
} from './types.js';
import type { Gw2EventDraft } from '../equipment/relics/types.js';

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
   * Schedules only the packets produced by the condition's natural lifetime.
   * Whole stack-seconds tick from the application timestamp, while a fractional
   * remainder belongs to natural expiration. The observation horizon filters
   * those packets; it is not itself a tick or expiration timestamp.
   */
  function enqueueNaturalConditionTicks(ctx: Gw2ResolverRuntime, application: Gw2ResolvedConditionApplication): void {
    const naturalDuration = application.effectiveDuration;
    const observableDuration = Math.max(0, ctx.horizon - application.at);
    // Bound whole ticks by both natural duration and the visible window without
    // converting the unobserved portion into endpoint damage.
    const naturalFullTicks = Math.floor(naturalDuration + EPSILON);
    const observableFullTicks = Math.floor(observableDuration + EPSILON);
    const fullTicks = Math.min(naturalFullTicks, observableFullTicks);
    for (let index = 1; index <= fullTicks; index += 1) {
      enqueueOrdered(ctx.queue, {
        type: 'condition_tick',
        at: application.at + index,
        source: application.source,
        sourceId: application.sourceId,
        actorType: application.actorType,
        skillId: application.skillId,
        condition: application.condition,
        application,
        fraction: 1
      });
    }

    const remainder = Math.max(0, naturalDuration - naturalFullTicks);
    // A fractional packet is real only when the condition naturally expires
    // within the observation window.
    if (remainder > EPSILON && application.naturalExpiresAt <= ctx.horizon + EPSILON) {
      enqueueOrdered(ctx.queue, {
        type: 'condition_tick',
        at: application.naturalExpiresAt,
        source: application.source,
        sourceId: application.sourceId,
        actorType: application.actorType,
        skillId: application.skillId,
        condition: application.condition,
        application,
        fraction: remainder
      });
    }
  }

  function applyCondition(ctx: Gw2ResolverRuntime, event: Gw2EventDraft): Gw2ResolvedConditionApplication | null {
    const name = ctx.helpers.conditionName(event.condition);
    const queryEvent = event as unknown as Gw2ResolverEvent;
    // Duration is snapshotted at application time. Damage stats and multipliers
    // are deliberately queried later at each tick.
    const stats = ctx.query.statsAt(event.at, queryEvent, ctx);
    const durationMultiplier = event.fixedDuration
      ? 1
      : ctx.query.conditionDurationMultiplier(name, event.at, stats, queryEvent, ctx);
    const baseDurationMultiplier = event.fixedDuration
      ? 1
      : (ctx.query.conditionBaseDurationMultiplier?.(name, event.at, queryEvent, ctx) ?? 1);
    const duration = Math.max(0, Number(event.duration || 0)) * baseDurationMultiplier * durationMultiplier;
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
      damage: 0,
      damagingStackSeconds: 0,
      damageTicks: []
    } as Gw2ResolvedConditionApplication;
    ctx.conditionApplications.push(application);
    ctx.resolved.push(application);

    const state = ensureConditionState(ctx, name);
    state.stacks.push({
      appliedAt: event.at,
      // Stack queries use natural expiry. The resolver horizon only limits
      // scheduled damage, not the semantic duration of the application.
      expiresAt,
      weight: stacks,
      application
    });
    enqueueNaturalConditionTicks(ctx, application);

    reactions.dispatch('condition.applied', ctx, application, {
      application,
      activeConditionStackCount
    });
    return application;
  }

  function handleConditionTick(ctx: Gw2ResolverRuntime, event: Gw2ResolverEvent): Gw2ConditionTickResult | null {
    const application = event.application;
    const fraction = clamp(Number(event.fraction || 0), 0, 1);
    if (!application || !fraction) return null;
    if (Number.isFinite(Number(application.removedAt)) && event.at >= Number(application.removedAt) - EPSILON) {
      return null;
    }

    const condition = event.condition || application.condition;

    const stats = ctx.query.statsAt(event.at, application, ctx);
    // Dynamic effects (boons, target health, profession modifiers) are sampled
    // at tick time rather than frozen with the application.
    const perStack =
      conditionRate(ctx, condition, stats.conditionDamage) *
      ctx.query.conditionMultiplier(condition, event.at, application, ctx);
    const stackSeconds = application.stacks * fraction;
    const damage = perStack * stackSeconds;
    application.damage += damage;
    application.damagingStackSeconds += stackSeconds;
    // damagingStackSeconds is the integral used by result tables to report
    // average stacks, including fractional ticks at natural expiration.
    application.damageTicks.push({
      at: event.at,
      damage,
      fraction
    });
    ctx.totals.condition += damage;
    ctx.addBreakdown(application.name, damage, 'conditionDamage', 0, application);

    const conditionEntry = ctx.conditions.get(condition) || {
      name: condition,
      damage: 0,
      stackSeconds: 0
    };
    conditionEntry.damage += damage;
    conditionEntry.stackSeconds += stackSeconds;
    ctx.conditions.set(condition, conditionEntry);
    if (damage > 0) ctx.markDamageTime(event.at);
    return { application, damage, fraction, perStack, stackSeconds };
  }

  return Object.freeze({
    activeConditionStackCount,
    applyCondition,
    handleConditionTick
  });
}
