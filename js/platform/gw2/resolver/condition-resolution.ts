import { EPSILON } from "../../engine/clock.js";
import { enqueueOrdered } from "../../engine/event-queue.js";
import { conditionTickDamage } from "../damage.js";
import { handleConditionRelics } from "../relic-rules.js";
import { permanentTargetConditionStacks } from "../target-state.js";

import type {
  Gw2ApplyCondition,
  Gw2ConditionResolution,
  Gw2ConditionTickResult,
  Gw2EventDraft,
  Gw2ResolvedConditionApplication,
  Gw2ResolverConditionStack,
  Gw2ResolverConditionState,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "../types.js";

interface CreateGw2ConditionResolutionOptions {
  readonly targetHealthMultiplier?: (
    context: Gw2ResolverRuntime,
  ) => number;
  readonly onConditionApplied?: (
    context: Gw2ResolverRuntime,
    application: Gw2ResolvedConditionApplication,
  ) => unknown;
}

const MOVING_TORMENT = Object.freeze({ base: 22, scaling: 0.06 });
const CONFUSION_ACTIVATION = Object.freeze({ base: 16.24, scaling: 0.0325 });

/**
 * Creates timestamp-aware condition resolution shared by GW2 professions.
 * Profession effects subscribe through onConditionApplied instead of being
 * embedded in the common condition pipeline.
 */
export function createGw2ConditionResolution({
  targetHealthMultiplier = () => 1,
  onConditionApplied = () => {},
}: CreateGw2ConditionResolutionOptions = {}): Readonly<
  Gw2ConditionResolution
> {
  function activeStacks(
    ctx: Gw2ResolverRuntime,
    name: string,
    at: number,
  ): Gw2ResolverConditionStack[] {
    const state = ctx.conditionState.get(name);
    if (!state) return [];
    // Expiry is half-open: a stack is active before expiresAt, not at it.
    return state.stacks.filter(
      (stack) =>
        stack.appliedAt <= at + EPSILON &&
        stack.expiresAt > at + EPSILON &&
        stack.weight > 0,
    );
  }

  function activeConditionStackCount(
    ctx: Gw2ResolverRuntime,
    name: string,
    at: number,
  ): number {
    // Target configuration represents ambient stacks that have no application
    // event, so it is added separately from player-created stack state.
    return (
      permanentTargetConditionStacks(ctx.config, name) +
      activeStacks(ctx, name, at).reduce(
        (total, stack) => total + stack.weight,
        0,
      )
    );
  }

  function conditionRate(
    ctx: Gw2ResolverRuntime,
    name: string,
    conditionDamage: number,
  ): number {
    // Torment switches formula entirely for a moving target. Confusion keeps
    // its passive tick and adds configured activation damage as an average rate.
    if (name === "Torment" && ctx.config.target?.moving) {
      return MOVING_TORMENT.base + MOVING_TORMENT.scaling * conditionDamage;
    }
    let rate = conditionTickDamage(name, conditionDamage);
    if (name === "Confusion") {
      rate +=
        Number(ctx.config.target?.confusionActivationsPerSecond || 0) *
        (CONFUSION_ACTIVATION.base +
          CONFUSION_ACTIVATION.scaling * conditionDamage);
    }
    return rate;
  }

  function ensureConditionState(
    ctx: Gw2ResolverRuntime,
    name: string,
  ): Gw2ResolverConditionState {
    if (!ctx.conditionState.has(name)) {
      ctx.conditionState.set(name, { stacks: [] });
    }
    return ctx.conditionState.get(name)!;
  }

  function scheduleApplicationTicks(
    ctx: Gw2ResolverRuntime,
    application: Gw2ResolvedConditionApplication,
  ): void {
    const activeDuration = application.activeDuration;
    // Schedule one event per damaging stack-second. A horizon-clipped remainder
    // becomes a fractional final tick so short applications retain their share.
    const fullTicks = Math.floor(activeDuration + EPSILON);
    for (let index = 1; index <= fullTicks; index += 1) {
      enqueueOrdered(ctx.queue, {
        type: "condition_tick",
        at: application.at + index,
        source: application.source,
        sourceId: application.sourceId,
        actorType: application.actorType,
        skillId: application.skillId,
        condition: application.condition,
        application,
        fraction: 1,
      });
    }
    const remainder = Math.max(0, activeDuration - fullTicks);
    if (remainder > EPSILON) {
      enqueueOrdered(ctx.queue, {
        type: "condition_tick",
        at: application.at + activeDuration,
        source: application.source,
        sourceId: application.sourceId,
        actorType: application.actorType,
        skillId: application.skillId,
        condition: application.condition,
        application,
        fraction: remainder,
      });
    }
  }

  function applyCondition(
    ctx: Gw2ResolverRuntime,
    event: Gw2EventDraft,
  ): Gw2ResolvedConditionApplication | null {
    const name = ctx.helpers.conditionName(event.condition);
    const queryEvent = event as unknown as Gw2ResolverEvent;
    // Duration is snapshotted at application time. Damage stats and multipliers
    // are deliberately queried later at each tick.
    const stats = ctx.query.statsAt(event.at, queryEvent, ctx);
    const durationMultiplier = event.fixedDuration
      ? 1
      : ctx.query.conditionDurationMultiplier(
          name,
          event.at,
          stats,
          queryEvent,
          ctx,
        );
    const baseDurationMultiplier = event.fixedDuration
      ? 1
      : (ctx.query.conditionBaseDurationMultiplier?.(
          name,
          event.at,
          queryEvent,
          ctx,
        ) ?? 1);
    const duration =
      Math.max(0, Number(event.duration || 0)) *
      baseDurationMultiplier *
      durationMultiplier;
    const expiresAt = event.at + duration;
    const stacks = Math.max(0, Number(event.stacks || 0));
    if (!stacks || !duration) return null;

    const application = {
      ...event,
      sourceId:
        event.sourceId ??
        event.skillId ??
        event.skillName ??
        event.type,
      name:
        event.name ||
        `${event.skillName || event.sourceId || "Condition"} — ${name}`,
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
      damageTicks: [],
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
      application,
    });
    scheduleApplicationTicks(ctx, application);

    onConditionApplied(ctx, application);
    handleConditionRelics(ctx, application, {
      activeConditionStackCount,
      applyCondition: applyRelicCondition,
    });
    return application;
  }

  const applyRelicCondition: Gw2ApplyCondition = (context, event) =>
    applyCondition(
      context as Gw2ResolverRuntime,
      event,
    );

  function handleConditionTick(
    ctx: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ): Gw2ConditionTickResult | null {
    const application = event.application;
    const fraction = Math.max(0, Math.min(1, Number(event.fraction || 0)));
    if (!application || !fraction) return null;
    const condition = event.condition || application.condition;

    const stats = ctx.query.statsAt(event.at, application, ctx);
    // Dynamic effects (boons, target health, profession modifiers) are sampled
    // at tick time rather than frozen with the application.
    const perStack =
      conditionRate(ctx, condition, stats.conditionDamage) *
      ctx.query.conditionMultiplier(
        condition,
        event.at,
        application,
        ctx,
      ) *
      targetHealthMultiplier(ctx);
    const stackSeconds = application.stacks * fraction;
    const damage = perStack * stackSeconds;
    application.damage += damage;
    application.damagingStackSeconds += stackSeconds;
    // damagingStackSeconds is the integral used by result tables to report
    // average stacks, including fractional ticks at the horizon.
    application.damageTicks.push({
      at: event.at,
      damage,
      fraction,
    });
    ctx.totals.condition += damage;
    ctx.addBreakdown(
      application.name,
      damage,
      "conditionDamage",
      0,
      application,
    );

    const conditionEntry = ctx.conditions.get(condition) || {
      name: condition,
      damage: 0,
      stackSeconds: 0,
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
    handleConditionTick,
  });
}
