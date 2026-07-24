/**
 * Relic trigger rules: strike/condition multipliers, active-hit effects, passive timelines.
 */

import { EPSILON } from "../engine/clock.js";

/**
 * Calculates strike damage multiplier for active relics.
 * - Thief: +1% per stack (up to 5 stacks, 6s duration, triggers on weapon skills).
 * - Fireworks: +7% while active (6s after weapon cooldown ≥20).
 * - Claw: +7% while active (8s after control).
 * - Peitha: +10% while active (4s after Peitha event).
 * - Eagle: +10% when target > 50% health.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Damage event
 * @returns {number} Strike multiplier
 */
export function relicStrikeMultiplier(ctx, event) {
  const { config, relic, totals } = ctx;
  const at = event.at;
  switch (config.relic) {
    case "Thief":
      return relic.thiefStacks > 0 && relic.thiefUntil > at
        ? 1 + relic.thiefStacks * 0.01
        : 1;
    case "Fireworks":
    case "Claw":
    case "Peitha":
      if (relic.buffUntil <= at) return 1;
      return config.relic === "Peitha" ? 1.1 : 1.07;
    case "Eagle": {
      const targetHealth = Number(config.target?.health || 0);
      return targetHealth > 0
        && totals.strike + totals.condition >= targetHealth * 0.5
        ? 1.1
        : 1;
    }
    default:
      return 1;
  }
}

/**
 * Applies Mist Stranger siphon damage: 105 flat per player hit.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Damage event
 */
export function applyMistStranger(ctx, event) {
  if (ctx.config.relic !== "Mist Stranger" || event.source !== "Player") return;
  const siphon = 105 * Number(event.hits || 1);
  ctx.totals.strike += siphon;
  ctx.addBreakdown(
    "Relic of the Mist Stranger",
    siphon,
    "strikeDamage",
    event.hits,
  );
  ctx.resolved.push({
    type: "damage",
    at: event.at,
    name: "Relic of the Mist Stranger",
    skillName: "Relic of the Mist Stranger",
    triggeredBy: event.skillName,
    coefficient: 0,
    hits: event.hits,
    source: "Relic",
    damage: siphon,
  });
  ctx.recordProc(
    "relic",
    "Relic of the Mist Stranger",
    event.at,
    event.skillName,
  );
}

/**
 * Handles active relic procs after player hits: Thief (stack/duration), Fireworks (cooldown ≥20).
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Damage event
 * @param {Object} skill - Skill object (from skillsByName)
 */
export function handleRelicsAfterHit(ctx, event, skill) {
  if (
    ctx.config.relic === "Thief"
    && event.source === "Player"
    && skill?.type === "Weapon"
    && (Number(skill.cooldown || 0) > 0 || skill.resource)
  ) {
    if (ctx.relic.thiefUntil <= event.at) ctx.relic.thiefStacks = 0;
    ctx.relic.thiefStacks = Math.min(5, ctx.relic.thiefStacks + 1);
    ctx.relic.thiefUntil = event.at + 6;
    ctx.recordProc(
      "relic",
      "Relic of the Thief",
      event.at,
      event.skillName,
      `${ctx.relic.thiefStacks}/5 stacks`,
    );
  }
  if (
    ctx.config.relic === "Fireworks"
    && event.source === "Player"
    && Number(skill?.cooldown || 0) >= 20
  ) {
    const wasActive = ctx.relic.buffUntil > event.at;
    ctx.relic.buffUntil = Math.max(ctx.relic.buffUntil, event.at + 6);
    if (!wasActive) {
      ctx.recordProc(
        "relic",
        "Relic of Fireworks",
        event.at,
        event.skillName,
      );
    }
  }
}

function maybeTriggerAkeem(
  ctx,
  event,
  { activeConditionStackCount, applyCondition },
) {
  if (
    ctx.config.relic !== "Akeem"
    || event.at < ctx.relic.akeemReadyAt - EPSILON
  ) return;
  if (
    activeConditionStackCount(ctx, "Confusion", event.at) < 5
    && activeConditionStackCount(ctx, "Torment", event.at) < 5
  ) return;

  ctx.relic.akeemReadyAt = event.at + 10;
  ctx.recordProc("relic", "Relic of Akeem", event.at, event.skillName);
  applyCondition(ctx, {
    type: "condition",
    at: event.at,
    name: "Relic of Akeem — Confusion",
    skillName: "Relic of Akeem",
    condition: "Confusion",
    duration: 10,
    stacks: 2,
    source: "Relic",
  });
  applyCondition(ctx, {
    type: "condition",
    at: event.at,
    name: "Relic of Akeem — Torment",
    skillName: "Relic of Akeem",
    condition: "Torment",
    duration: 10,
    stacks: 2,
    source: "Relic",
  });
}

/**
 * Handles control event relic triggers: Claw (+7% for 8s), Akeem (6+ Confusion/Torment → 2 Confusion + 2 Torment).
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Control event
 * @param {Object} conditionHelpers - {activeConditionStackCount, applyCondition}
 */
export function handleControlRelics(ctx, event, conditionHelpers) {
  if (ctx.config.relic === "Claw") {
    const wasActive = ctx.relic.buffUntil > event.at;
    ctx.relic.buffUntil = Math.max(ctx.relic.buffUntil, event.at + 8);
    if (!wasActive) {
      ctx.recordProc("relic", "Relic of the Claw", event.at, event.skillName);
    }
  }
  maybeTriggerAkeem(ctx, event, conditionHelpers);
}

/**
 * Handles Peitha event: applies 2 Torment (7s) every 4s.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Peitha event
 * @param {Function} applyCondition - Condition application function
 */
export function handlePeithaRelic(ctx, event, applyCondition) {
  if (ctx.config.relic !== "Peitha") return;
  if (event.at < ctx.relic.peithaReadyAt - EPSILON) return;
  ctx.relic.peithaReadyAt = event.at + 4;
  ctx.relic.buffUntil = event.at + 4;
  ctx.recordProc("relic", "Relic of Peitha", event.at, event.skillName);
  applyCondition(ctx, {
    type: "condition",
    at: event.at,
    name: "Relic of Peitha — Torment",
    skillName: "Relic of Peitha",
    condition: "Torment",
    duration: 7,
    stacks: 2,
    source: "Relic",
  });
}

/**
 * Records passive relic timeline for UI display: Aristocracy (stacks timeline), Thorns (stack timeline).
 * @param {Object} ctx - Resolver context
 * @param {Array} events - All scheduled events
 * @param {number} rotationEndTime - Rotation end time
 */
export function recordPassiveRelicTimeline(ctx, events, rotationEndTime) {
  if (ctx.config.relic === "Aristocracy") {
    let readyAt = 0;
    let stacks = 0;
    let expiresAt = -Infinity;
    for (const event of events) {
      if (
        event.type !== "weakness_vulnerability"
        || event.at < readyAt - EPSILON
      ) continue;
      if (event.at >= expiresAt - EPSILON) stacks = 0;
      stacks = Math.min(5, stacks + 1);
      expiresAt = event.at + 8;
      readyAt = event.at + 1;
      ctx.recordProc(
        "relic",
        "Relic of Aristocracy",
        event.at,
        event.skillName,
        `${stacks}/5 stacks`,
      );
    }
  }
  if (ctx.config.relic === "Thorns") {
    for (
      let at = 3, stacks = 1;
      at <= rotationEndTime + EPSILON && stacks <= 10;
      at += 5, stacks += 1
    ) {
      ctx.recordProc(
        "relic",
        "Relic of Thorns",
        at,
        "Incoming enemy hit",
        `${stacks}/10 stacks`,
      );
    }
  }
}
