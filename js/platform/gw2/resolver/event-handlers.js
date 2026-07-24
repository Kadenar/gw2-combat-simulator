import { EPSILON } from "../../engine/clock.js";
import { enqueueOrdered } from "../../engine/event-queue.js";
import { SIGIL_PROCS } from "../gear-data.js";
import {
  applyMistStranger,
  handleControlRelics,
  handlePeithaRelic,
  handleRelicsAfterHit,
} from "../relic-rules.js";

const noop = () => {};

function requireFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`GW2 resolver handlers require ${name}.`);
  }
  return value;
}

function triggeringSkill(ctx, event) {
  return ctx.helpers.skillsByName.get(event.skillName);
}

function activeSigilNames(ctx, at, weaponSet = null) {
  const activeSet = weaponSet ?? ctx.query.activeWeaponSetAt(at);
  return ctx.config.sigilSets?.[Math.max(1, activeSet) - 1]?.names || [];
}

function sigilReady(ctx, name, at) {
  return at >= (ctx.sigil.readyAt.get(name) || 0) - EPSILON;
}

function armSigil(ctx, name, at, cooldown) {
  ctx.sigil.readyAt.set(name, at + cooldown);
}

function recordSigil(ctx, name, at, sourceSkill = "") {
  ctx.recordProc("sigil", `Sigil of ${name}`, at, sourceSkill);
}

function queueSigilStrike(ctx, name, at, proc, sourceSkill) {
  enqueueOrdered(ctx.queue, {
    type: "damage",
    at,
    name: `Sigil of ${name}`,
    skillName: `Sigil of ${name}`,
    coefficient: proc.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Sigil",
    sourceId: `sigil.${name.toLowerCase()}`,
    weaponStrength: proc.weaponStrength,
    skillWeapon: "Unequipped",
    noCrit: !proc.canCrit,
    triggeredBy: sourceSkill,
  });
}

function handleCriticalSigils(ctx, event, hitContext, applyCondition) {
  if (event.source !== "Player" || !(event.coefficient > 0)) return;
  const names = activeSigilNames(ctx, event.at)
    .filter(name => SIGIL_PROCS[name]?.trigger === "crit");
  if (!names.length || hitContext.critical.chance <= 0) return;

  ctx.sigil.criticalProgress += hitContext.critical.chance;
  if (ctx.sigil.criticalProgress < 1 - EPSILON) return;
  ctx.sigil.criticalProgress -= 1;

  for (const name of names) {
    const proc = SIGIL_PROCS[name];
    if (!sigilReady(ctx, name, event.at)) continue;
    armSigil(ctx, name, event.at, proc.cooldown);
    if (proc.effect === "strike") {
      queueSigilStrike(ctx, name, event.at, proc, event.skillName);
    } else if (proc.effect === "condition") {
      applyCondition(ctx, {
        type: "condition",
        at: event.at,
        name: `Sigil of ${name} — ${proc.condition}`,
        skillName: `Sigil of ${name}`,
        condition: proc.condition,
        duration: proc.duration,
        stacks: proc.stacks,
        source: "Sigil",
        sourceId: `sigil.${name.toLowerCase()}`,
      });
    }
    recordSigil(ctx, name, event.at, event.skillName);
  }
}

function consumeDoom(ctx, event, applyCondition) {
  if (
    !ctx.sigil.doomPending
    || event.source !== "Player"
    || !(event.coefficient > 0)
  ) return;
  const proc = SIGIL_PROCS.Doom;
  ctx.sigil.doomPending = false;
  applyCondition(ctx, {
    type: "condition",
    at: event.at,
    name: "Sigil of Doom — Poisoned",
    skillName: "Sigil of Doom",
    condition: proc.condition,
    duration: proc.duration,
    stacks: proc.stacks,
    source: "Sigil",
    sourceId: "sigil.doom",
  });
  recordSigil(ctx, "Doom", event.at, event.skillName);
}

function reactionFor(reactions, eventType) {
  return reactions?.[eventType] || noop;
}

/**
 * Builds the complete standard GW2 resolver handler set.
 *
 * Damage and condition math are injected because professions can supply richer
 * timestamp-aware queries without taking ownership of sigils, relics, event
 * dispatch, or the other common event behavior.
 */
export function createGw2ResolverEventHandlers({
  hitResolution,
  conditions,
  eventReactions = {},
} = {}) {
  const buildHitResolutionContext = requireFunction(
    hitResolution?.buildContext,
    "hitResolution.buildContext",
  );
  const applyResolvedHit = requireFunction(
    hitResolution?.apply,
    "hitResolution.apply",
  );
  const activeConditionStackCount = requireFunction(
    conditions?.activeStackCount,
    "conditions.activeStackCount",
  );
  const applyCondition = requireFunction(
    conditions?.apply,
    "conditions.apply",
  );
  const handleConditionTick = requireFunction(
    conditions?.tick,
    "conditions.tick",
  );

  const handlers = {
    action: noop,
    combat_start: noop,
    marker: noop,
    proc: noop,
    resource: noop,
    buff: noop,
    weakness_vulnerability: noop,

    damage(ctx, event) {
      const hitContext = buildHitResolutionContext(ctx, event);
      applyResolvedHit(ctx, event, hitContext);
      applyMistStranger(ctx, event);
      reactionFor(eventReactions, "damage")(ctx, event, {
        hitContext,
        applyCondition,
      });
      handleCriticalSigils(ctx, event, hitContext, applyCondition);
      consumeDoom(ctx, event, applyCondition);
      handleRelicsAfterHit(ctx, event, triggeringSkill(ctx, event));
    },

    condition(ctx, event) {
      applyCondition(ctx, event);
    },

    condition_tick(ctx, event) {
      const resolved = handleConditionTick(ctx, event);
      reactionFor(eventReactions, "condition_tick")(ctx, event, { resolved });
    },

    control(ctx, event) {
      handleControlRelics(ctx, event, {
        activeConditionStackCount,
        applyCondition,
      });
      for (const name of activeSigilNames(ctx, event.at)) {
        const proc = SIGIL_PROCS[name];
        if (
          proc?.trigger !== "control"
          || !sigilReady(ctx, name, event.at)
        ) continue;
        armSigil(ctx, name, event.at, proc.cooldown);
        if (proc.effect === "severance") {
          ctx.sigil.severanceUntil = Math.max(
            ctx.sigil.severanceUntil,
            event.at + proc.duration,
          );
        }
        recordSigil(ctx, name, event.at, event.skillName);
      }
      reactionFor(eventReactions, "control")(ctx, event, { applyCondition });
    },

    blind(ctx, event) {
      reactionFor(eventReactions, "blind")(ctx, event, { applyCondition });
    },

    peitha(ctx, event) {
      handlePeithaRelic(ctx, event, applyCondition);
      reactionFor(eventReactions, "peitha")(ctx, event, { applyCondition });
    },

    weapon_set(ctx, event) {
      for (const name of activeSigilNames(ctx, event.at, event.weaponSet)) {
        const proc = SIGIL_PROCS[name];
        if (
          proc?.trigger !== "swap"
          || !sigilReady(ctx, name, event.at)
        ) continue;
        armSigil(ctx, name, event.at, proc.cooldown);
        if (proc.effect === "next-hit-condition") {
          ctx.sigil.doomPending = true;
          continue;
        }
        if (proc.effect === "condition") {
          applyCondition(ctx, {
            type: "condition",
            at: event.at,
            name: `Sigil of ${name} — ${proc.condition}`,
            skillName: `Sigil of ${name}`,
            condition: proc.condition,
            duration: proc.duration,
            stacks: proc.stacks,
            source: "Sigil",
            sourceId: `sigil.${name.toLowerCase()}`,
          });
          recordSigil(ctx, name, event.at, "Swap Weapons");
          continue;
        }
        if (proc.effect === "strike") {
          queueSigilStrike(ctx, name, event.at, proc, "Swap Weapons");
          recordSigil(ctx, name, event.at, "Swap Weapons");
        }
      }
      reactionFor(eventReactions, "weapon_set")(ctx, event, { applyCondition });
    },
  };

  return Object.freeze(handlers);
}
