/**
 * Condition application and tick resolution.
 * Base formulas from core damage module; resolver adds moving Torment, Confusion activation damage.
 */
import { conditionTickDamage } from "../../../platform/gw2/damage.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { EPSILON } from "../../../platform/engine/clock.js";
import { permanentTargetConditionStacks } from "../../../platform/gw2/target-state.js";
import { targetHealthMultiplier } from "./damage-modifiers.js";

/** Moving Torment: base 22 + 0.06 per condition damage. */
const MOVING_TORMENT = { base: 22, scaling: 0.06 };
/** Confusion activation damage: base 16.24 + 0.0325 per condition damage. */
const CONFUSION_ACTIVATION = { base: 16.24, scaling: 0.0325 };

/** Returns active stacks of a condition at time (filters expired, zero-weight). */
function activeStacks(ctx, name, at) {
  const state = ctx.conditionState.get(name);
  if (!state) return [];
  return state.stacks.filter(stack =>
    stack.appliedAt <= at + EPSILON
    && stack.expiresAt > at + EPSILON
    && stack.weight > 0);
}

/**
 * Calculates total active stacks of condition at time: permanent target stacks + applied stacks.
 * @param {Object} ctx - Resolver context
 * @param {string} name - Condition name (e.g., "Burning")
 * @param {number} at - Timestamp
 * @returns {number} Total active stack count
 */
export function activeConditionStackCount(ctx, name, at) {
  return permanentTargetConditionStacks(ctx.config, name)
    + activeStacks(ctx, name, at)
      .reduce((total, stack) => total + stack.weight, 0);
}

/**
 * Calculates per-second damage rate for a condition tick.
 * Moving Torment: base formula. Confusion: tick + activation damage.
 * @param {Object} ctx - Resolver context
 * @param {string} name - Condition name
 * @param {number} conditionDamage - Condition damage stat
 * @returns {number} Damage per stack per second
 */
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

/** Ensures condition state exists; creates empty stack array if needed. */
function ensureConditionState(ctx, name) {
  if (!ctx.conditionState.has(name)) {
    ctx.conditionState.set(name, {
      stacks: [],
    });
  }
  return ctx.conditionState.get(name);
}

/**
 * Schedules all condition ticks for an application (full + fractional).
 * Full ticks: 1 per second, fractional tick at end if remainder exists.
 * @param {Object} ctx - Resolver context
 * @param {Object} application - Condition application with at, activeDuration
 */
function scheduleApplicationTicks(ctx, application) {
  const activeDuration = application.activeDuration;
  const fullTicks = Math.floor(activeDuration + EPSILON);
  for (let index = 1; index <= fullTicks; index += 1) {
    enqueueOrdered(ctx.queue, {
      type: "condition_tick",
      at: application.at + index,
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
      condition: application.condition,
      application,
      fraction: remainder,
    });
  }
}

/** Tracks Bloodsong progress for condition application (5 stacks = 1 blade). */
function recordBloodsong(ctx, application) {
  if (
    application.condition !== "Bleeding"
    || !ctx.traits.has("Bloodsong")
    || application.stacks <= 0
  ) return;

  ctx.profession.bloodsongProgress += application.stacks;
  while (ctx.profession.bloodsongProgress >= 5 - EPSILON) {
    ctx.profession.bloodsongProgress -= 5;
  }
}

/**
 * Triggers Fractal relic on 6+ Bleeding stacks (20s cooldown).
 * Applies 2 Burning + 3 Torment.
 * @param {Object} ctx - Resolver context
 * @param {Object} application - Condition application
 */
function maybeTriggerFractal(ctx, application) {
  if (
    ctx.config.relic !== "Fractal"
    || application.condition !== "Bleeding"
    || application.at < ctx.relic.fractalReadyAt - EPSILON
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
  });
}

/**
 * Applies a condition application: calculates effective duration, creates application state,
 * schedules ticks, triggers Bloodsong/Fractal.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Condition event with condition, duration, stacks, at
 * @returns {Object|null} Application object or null if invalid (0 stacks or duration)
 */
export function applyCondition(ctx, event) {
  const name = ctx.helpers.conditionName(event.condition);
  const stats = ctx.query.statsAt(event.at);
  const duration = Math.max(0, Number(event.duration || 0))
    * ctx.query.conditionDurationMultiplier(name, event.at, stats, event);
  const expiresAt = event.at + duration;
  const stacks = Math.max(0, Number(event.stacks || 0));
  if (!stacks || !duration) return null;

  const application = {
    ...event,
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

  recordBloodsong(ctx, application);
  maybeTriggerFractal(ctx, application);
  return application;
}

/**
 * Processes a condition tick: calculates damage (rate × stacks × fraction × multipliers),
 * tracks per-condition totals and tick details.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Condition tick event with condition, application, fraction, at
 */
export function handleConditionTick(ctx, event) {
  const application = event.application;
  const fraction = Math.max(0, Math.min(1, Number(event.fraction || 0)));
  if (!application || !fraction) return;

  const stats = ctx.query.statsAt(event.at);
  const perStack = conditionRate(ctx, event.condition, stats.conditionDamage)
    * ctx.query.conditionMultiplier(
      event.condition,
      event.at,
      application,
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
}
