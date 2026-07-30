/**
 * Relic trigger rules: strike/condition multipliers, active effects, and
 * passive timelines. Each simulation selects exactly one rule set and creates
 * only the mutable state required by that relic.
 */

import { EPSILON } from "../engine/clock.js";
import { enqueueOrdered } from "../engine/event-queue.js";
import { isInternalCooldownReady } from "../engine/internal-cooldown.js";
import { isGw2PlayerActorEvent } from "./event-ownership.js";

const STATELESS_RELIC = Object.freeze({});

function defineRelic(rules) {
  return Object.freeze(rules);
}

function recordTimedBuffProc(
  ctx,
  state,
  event,
  {
    duration,
    name,
    detail = null,
  },
) {
  const wasActive = state.buffUntil > event.at;
  state.buffUntil = Math.max(state.buffUntil, event.at + duration);
  ctx.recordProc(
    "relic",
    name,
    event.at,
    event.skillName,
    detail ?? (wasActive ? "refreshed" : "activated"),
  );
}

const RELIC_RULES = Object.freeze({
  Akeem: defineRelic({
    createState: () => ({ readyAt: 0 }),
    control(
      ctx,
      state,
      event,
      { activeConditionStackCount, applyCondition },
    ) {
      if (!isInternalCooldownReady(event.at, state.readyAt)) return;
      if (
        activeConditionStackCount(ctx, "Confusion", event.at) < 5 &&
        activeConditionStackCount(ctx, "Torment", event.at) < 5
      ) {
        return;
      }

      state.readyAt = event.at + 10;
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
    },
  }),

  Aristocracy: defineRelic({
    timeline(ctx, _state, events) {
      let readyAt = 0;
      let stacks = 0;
      let expiresAt = -Infinity;
      for (const event of events) {
        if (
          event.type !== "weakness_vulnerability" ||
          (ctx.combatStartTime != null &&
            event.at < ctx.combatStartTime - EPSILON) ||
          !isInternalCooldownReady(event.at, readyAt)
        ) {
          continue;
        }
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
    },
  }),

  Brawler: defineRelic({
    createState: () => ({ readyAt: 0, buffUntil: 0 }),
    boon(ctx, state, event) {
      const kind = String(event?.kind || "").toLowerCase();
      if (
        (kind !== "protection" && kind !== "resolution") ||
        !isGw2PlayerActorEvent(event) ||
        !(Number(event.duration) > 0) ||
        !(Number(event.stacks ?? 1) > 0) ||
        !isInternalCooldownReady(event.at, state.readyAt)
      ) {
        return;
      }

      state.readyAt = event.at + 8;
      state.buffUntil = event.at + 4;
      ctx.recordProc(
        "relic",
        "Relic of the Brawler",
        event.at,
        event.skillName,
        "activated",
      );
    },
    strikeMultiplier(_ctx, state, event) {
      return state.buffUntil > event.at ? 1.1 : 1;
    },
  }),

  Claw: defineRelic({
    createState: () => ({ buffUntil: 0 }),
    control(ctx, state, event) {
      recordTimedBuffProc(ctx, state, event, {
        duration: 8,
        name: "Relic of the Claw",
      });
    },
    strikeMultiplier(_ctx, state, event) {
      return state.buffUntil > event.at ? 1.07 : 1;
    },
  }),

  Dragonhunter: defineRelic({
    createState: () => ({ buffUntil: 0 }),
    afterHit(ctx, state, event, skill) {
      if (
        !isGw2PlayerActorEvent(event) ||
        !skill?.categories?.includes("Trap")
      ) {
        return;
      }
      recordTimedBuffProc(ctx, state, event, {
        duration: 5,
        name: "Relic of the Dragonhunter",
      });
    },
    conditionDurationBonus(_ctx, state, at) {
      return state.buffUntil > at ? 0.1 : 0;
    },
    strikeMultiplier(_ctx, state, event) {
      return state.buffUntil > event.at ? 1.1 : 1;
    },
  }),

  Eagle: defineRelic({
    strikeMultiplier(ctx) {
      const targetHealth = Number(ctx.config.target?.health || 0);
      return targetHealth > 0 &&
        ctx.totals.strike + ctx.totals.condition >= targetHealth * 0.5
        ? 1.1
        : 1;
    },
  }),

  Fireworks: defineRelic({
    createState: () => ({ buffUntil: 0 }),
    afterHit(ctx, state, event, skill) {
      if (
        !isGw2PlayerActorEvent(event) ||
        skill?.type !== "Weapon" ||
        Number(skill.cooldown || 0) < 20
      ) {
        return;
      }
      recordTimedBuffProc(ctx, state, event, {
        duration: 6,
        name: "Relic of Fireworks",
      });
    },
    strikeMultiplier(_ctx, state, event) {
      return state.buffUntil > event.at ? 1.07 : 1;
    },
  }),

  Fractal: defineRelic({
    createState: () => ({ readyAt: 0 }),
    condition(
      ctx,
      state,
      application,
      { activeConditionStackCount, applyCondition },
    ) {
      if (
        application?.condition !== "Bleeding" ||
        !isInternalCooldownReady(application.at, state.readyAt) ||
        activeConditionStackCount(ctx, "Bleeding", application.at) < 6
      ) {
        return;
      }

      // The triggering bleed is already in conditionState, so reaching six
      // stacks on this application is sufficient.
      state.readyAt = application.at + 20;
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
    },
  }),

  "Mist Stranger": defineRelic({
    damageResolved(ctx, _state, event) {
      if (!isGw2PlayerActorEvent(event)) return;
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
    },
  }),

  Peitha: defineRelic({
    createState: () => ({ readyAt: 0, buffUntil: 0 }),
    peitha(ctx, state, event, applyCondition) {
      if (!isInternalCooldownReady(event.at, state.readyAt)) return;
      state.readyAt = event.at + 4;
      state.buffUntil = event.at + 4;
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
    },
    strikeMultiplier(_ctx, state, event) {
      return state.buffUntil > event.at ? 1.1 : 1;
    },
  }),

  Shackles: defineRelic({
    createState: () => ({ readyAt: 0 }),
    condition(ctx, state, application) {
      if (
        application?.condition !== "Immobilized" ||
        !isGw2PlayerActorEvent(application) ||
        !isInternalCooldownReady(application.at, state.readyAt)
      ) {
        return;
      }

      state.readyAt = application.at + 10;
      ctx.recordProc(
        "relic",
        "Relic of the Shackles",
        application.at,
        application.skillName,
        "tethered",
      );
      enqueueOrdered(ctx.queue, {
        type: "damage",
        at: application.at + 5,
        name: "Relic of the Shackles",
        skillName: "Relic of the Shackles",
        coefficient: 3,
        hits: 1,
        hitIndex: 1,
        totalHits: 1,
        source: "Relic",
        sourceId: "relic.shackles",
        actorType: "effect",
        skillWeapon: "Unequipped",
        canCrit: true,
        triggeredBy: application.skillName,
      });
    },
    damageResolved(ctx, _state, event) {
      if (
        event?.type !== "damage" ||
        event.sourceId !== "relic.shackles" ||
        event.skillName !== "Relic of the Shackles"
      ) {
        return;
      }
      ctx.recordProc(
        "relic",
        "Relic of the Shackles",
        event.at,
        event.triggeredBy,
        "damage",
      );
    },
  }),

  Thief: defineRelic({
    createState: () => ({ stacks: 0, expiresAt: 0 }),
    afterHit(ctx, state, event, skill) {
      if (
        !isGw2PlayerActorEvent(event) ||
        skill?.type !== "Weapon" ||
        !(Number(skill.cooldown || 0) > 0 || skill.resource)
      ) {
        return;
      }
      if (state.expiresAt <= event.at) state.stacks = 0;
      state.stacks = Math.min(5, state.stacks + 1);
      state.expiresAt = event.at + 6;
      ctx.recordProc(
        "relic",
        "Relic of the Thief",
        event.at,
        event.skillName,
        `${state.stacks}/5 stacks`,
      );
    },
    strikeMultiplier(_ctx, state, event) {
      return state.stacks > 0 && state.expiresAt > event.at
        ? 1 + state.stacks * 0.01
        : 1;
    },
  }),

  Thorns: defineRelic({
    timeline(ctx, _state, _events, rotationEndTime) {
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
    },
  }),
});

/**
 * Creates the selected relic runtime. Rules are immutable and shared; mutable
 * state is created independently for each simulation.
 */
export function createRelicRuntime(name) {
  const selectedName = String(name || "");
  const rules = RELIC_RULES[selectedName] || STATELESS_RELIC;
  const state = rules.createState?.() || {};
  return Object.freeze({
    name: selectedName,
    rules,
    state,
  });
}

function invokeRelicHook(ctx, hook, ...args) {
  const handler = ctx?.relic?.rules?.[hook];
  if (typeof handler !== "function") return undefined;
  return handler(ctx, ctx.relic.state, ...args);
}

/**
 * Calculates the strike multiplier supplied by the selected relic.
 */
export function relicStrikeMultiplier(ctx, event) {
  return invokeRelicHook(ctx, "strikeMultiplier", event) ?? 1;
}

/**
 * Applies the selected relic's boon trigger, if any.
 */
export function handleBoonRelics(ctx, event) {
  invokeRelicHook(ctx, "boon", event);
}

/**
 * Applies effects that occur after a damage event resolves.
 */
export function handleRelicDamageResolved(ctx, event) {
  invokeRelicHook(ctx, "damageResolved", event);
}

/**
 * Applies selected relic triggers that inspect the triggering skill after hit.
 */
export function handleRelicsAfterHit(ctx, event, skill) {
  invokeRelicHook(ctx, "afterHit", event, skill);
}

/**
 * Applies selected relic triggers after a condition is recorded.
 */
export function handleConditionRelics(ctx, application, conditionHelpers) {
  invokeRelicHook(ctx, "condition", application, conditionHelpers);
}

/**
 * Returns the selected relic's additive condition-duration bonus.
 */
export function relicConditionDurationBonus(ctx, at) {
  return invokeRelicHook(ctx, "conditionDurationBonus", at) ?? 0;
}

/**
 * Applies the selected relic's control trigger, if any.
 */
export function handleControlRelics(ctx, event, conditionHelpers) {
  invokeRelicHook(ctx, "control", event, conditionHelpers);
}

/**
 * Applies the selected relic's explicit Peitha-event trigger, if any.
 */
export function handlePeithaRelic(ctx, event, applyCondition) {
  invokeRelicHook(ctx, "peitha", event, applyCondition);
}

/**
 * Records passive proc timelines for relics that do not need resolver state.
 */
export function recordPassiveRelicTimeline(ctx, events, rotationEndTime) {
  invokeRelicHook(ctx, "timeline", events, rotationEndTime);
}
