import { EPSILON } from "../../engine/clock.js";
import { enqueueOrdered } from "../../engine/event-queue.js";
import {
  isInternalCooldownReady,
} from "../../engine/internal-cooldown.js";
import { conditionTickDamage } from "../damage.js";
import { permanentTargetConditionStacks } from "../target-state.js";

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
} = {}) {
  function activeStacks(ctx, name, at) {
    const state = ctx.conditionState.get(name);
    if (!state) return [];
    return state.stacks.filter(stack =>
      stack.appliedAt <= at + EPSILON
      && stack.expiresAt > at + EPSILON
      && stack.weight > 0);
  }

  function activeConditionStackCount(ctx, name, at) {
    return permanentTargetConditionStacks(ctx.config, name)
      + activeStacks(ctx, name, at)
        .reduce((total, stack) => total + stack.weight, 0);
  }

  function conditionRate(ctx, name, conditionDamage) {
    if (name === "Torment" && ctx.config.target?.moving) {
      return MOVING_TORMENT.base + MOVING_TORMENT.scaling * conditionDamage;
    }
    let rate = conditionTickDamage(name, conditionDamage);
    if (name === "Confusion") {
      rate += Number(ctx.config.target?.confusionActivationsPerSecond || 0)
        * (
          CONFUSION_ACTIVATION.base
          + CONFUSION_ACTIVATION.scaling * conditionDamage
        );
    }
    return rate;
  }

  function ensureConditionState(ctx, name) {
    if (!ctx.conditionState.has(name)) {
      ctx.conditionState.set(name, { stacks: [] });
    }
    return ctx.conditionState.get(name);
  }

  function scheduleApplicationTicks(ctx, application) {
    const activeDuration = application.activeDuration;
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

  function maybeTriggerFractal(ctx, application) {
    if (
      ctx.config.relic !== "Fractal"
      || application.condition !== "Bleeding"
      || !isInternalCooldownReady(
        application.at,
        ctx.relic.fractalReadyAt,
      )
      || activeConditionStackCount(ctx, "Bleeding", application.at) < 6
    ) return;

    ctx.relic.fractalReadyAt = application.at + 20;
    ctx.recordProc(
      "relic",
      "Relic of the Fractal",
      application.at,
      application.skillName,
    );
    applyCondition(ctx, {
      type: "condition",
      at: application.at,
      name: "Relic of the Fractal — Burning",
      skillName: "Relic of the Fractal",
      condition: "Burning",
      duration: 8,
      stacks: 2,
      source: "Relic",
      sourceId: "relic.fractal",
    });
    applyCondition(ctx, {
      type: "condition",
      at: application.at,
      name: "Relic of the Fractal — Torment",
      skillName: "Relic of the Fractal",
      condition: "Torment",
      duration: 8,
      stacks: 3,
      source: "Relic",
      sourceId: "relic.fractal",
    });
  }

  function applyCondition(ctx, event) {
    const name = ctx.helpers.conditionName(event.condition);
    const stats = ctx.query.statsAt(event.at, event, ctx);
    const duration = Math.max(0, Number(event.duration || 0))
      * ctx.query.conditionDurationMultiplier(
        name,
        event.at,
        stats,
        event,
        ctx,
      );
    const expiresAt = event.at + duration;
    const stacks = Math.max(0, Number(event.stacks || 0));
    if (!stacks || !duration) return null;

    const application = {
      ...event,
      name:
        event.name
        || `${event.skillName || event.sourceId || "Condition"} — ${name}`,
      condition: name,
      stacks,
      effectiveDuration: duration,
      activeDuration: Math.max(
        0,
        Math.min(ctx.horizon, expiresAt) - event.at,
      ),
      expiresAt: Math.min(ctx.horizon, expiresAt),
      naturalExpiresAt: expiresAt,
      damage: 0,
      damagingStackSeconds: 0,
      damageTicks: [],
    };
    ctx.conditionApplications.push(application);
    ctx.resolved.push(application);

    const state = ensureConditionState(ctx, name);
    state.stacks.push({
      appliedAt: event.at,
      expiresAt,
      weight: stacks,
      application,
    });
    scheduleApplicationTicks(ctx, application);
    ctx.markDamageTime(event.at);

    onConditionApplied(ctx, application);
    maybeTriggerFractal(ctx, application);
    return application;
  }

  function handleConditionTick(ctx, event) {
    const application = event.application;
    const fraction = Math.max(0, Math.min(1, Number(event.fraction || 0)));
    if (!application || !fraction) return null;

    const stats = ctx.query.statsAt(event.at, application, ctx);
    const perStack = conditionRate(ctx, event.condition, stats.conditionDamage)
      * ctx.query.conditionMultiplier(
        event.condition,
        event.at,
        application,
        ctx,
      )
      * targetHealthMultiplier(ctx);
    const stackSeconds = application.stacks * fraction;
    const damage = perStack * stackSeconds;
    application.damage += damage;
    application.damagingStackSeconds += stackSeconds;
    application.damageTicks.push({
      at: event.at,
      damage,
      fraction,
    });
    ctx.totals.condition += damage;
    ctx.addBreakdown(application.name, damage, "conditionDamage");

    const conditionEntry = ctx.conditions.get(event.condition) || {
      name: event.condition,
      damage: 0,
      stackSeconds: 0,
    };
    conditionEntry.damage += damage;
    conditionEntry.stackSeconds += stackSeconds;
    ctx.conditions.set(event.condition, conditionEntry);
    ctx.markDamageTime(event.at);
    return { application, damage, fraction, perStack, stackSeconds };
  }

  return Object.freeze({
    activeConditionStackCount,
    applyCondition,
    handleConditionTick,
  });
}
