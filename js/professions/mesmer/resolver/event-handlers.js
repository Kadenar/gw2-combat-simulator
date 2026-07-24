/**
 * Event handlers for damage, conditions, control, blind, Peitha, and weapon sets.
 * Dispatches to damage/condition/trait handlers; manages sigil procs, trait effects, relic rules.
 */
import {
  applyResolvedHit,
  buildHitResolutionContext,
} from "./hit-resolution.js";
import {
  activeConditionStackCount,
  applyCondition,
  handleConditionTick,
} from "./condition-resolution.js";
import { SIGIL_PROCS } from "../../../platform/gw2/gear-data.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import {
  applyMistStranger,
  handleControlRelics,
  handlePeithaRelic,
  handleRelicsAfterHit,
} from "../../../platform/gw2/relic-rules.js";
import {
  handleCriticalTraits,
  triggerIneptitude,
} from "../mechanics/trait-rules.js";
import { EPSILON } from "../../../platform/engine/clock.js";

/** Looks up skill by name from skillsByName map. */
function triggeringSkill(ctx, event) {
  return ctx.helpers.skillsByName.get(event.skillName);
}

/** Gets active sigil names for active weapon set at time. */
function activeSigilNames(ctx, at, weaponSet = null) {
  const activeSet = weaponSet ?? ctx.query.activeWeaponSetAt(at);
  return ctx.config.sigilSets?.[Math.max(1, activeSet) - 1]?.names || [];
}

/** Checks if sigil is off cooldown at time. */
function sigilReady(ctx, name, at) {
  return at >= (ctx.sigil.readyAt.get(name) || 0) - EPSILON;
}

/** Sets sigil cooldown (ready at = now + cooldown). */
function armSigil(ctx, name, at, cooldown) {
  ctx.sigil.readyAt.set(name, at + cooldown);
}

/** Records sigil proc event for UI/breakdown. */
function recordSigil(ctx, name, at, sourceSkill = "") {
  ctx.recordProc("sigil", `Sigil of ${name}`, at, sourceSkill);
}

/** Queues a sigil strike damage event (by-name, with noCrit flag). */
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
    weaponStrength: proc.weaponStrength,
    skillWeapon: "Unequipped",
    noCrit: !proc.canCrit,
    triggeredBy: sourceSkill,
  });
}

/**
 * Processes critical-on-hit sigil triggers (e.g., Sigil of Malice).
 * Accumulates crit chance; triggers sigil when accumulated ≥ 1.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Damage event
 * @param {Object} hitContext - Hit resolution context with critical.chance
 */
function handleCriticalSigils(ctx, event, hitContext) {
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
      });
    }
    recordSigil(ctx, name, event.at, event.skillName);
  }
}

/** Consumes pending Doom (Sigil of Doom via swap), applies Poisoned on next player hit. */
function consumeDoom(ctx, event) {
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
  });
  recordSigil(ctx, "Doom", event.at, event.skillName);
}

/**
 * Handles damage event: resolves hit, applies to totals, triggers critical traits/sigils, relics, Doom.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Damage event
 */
export function handleDamageEvent(ctx, event) {
  const hitContext = buildHitResolutionContext(ctx, event);
  applyResolvedHit(ctx, event, hitContext);
  applyMistStranger(ctx, event);
  handleCriticalTraits(ctx, event, hitContext, applyCondition);
  handleCriticalSigils(ctx, event, hitContext);
  consumeDoom(ctx, event);
  handleRelicsAfterHit(ctx, event, triggeringSkill(ctx, event));
}

/**
 * Handles control event: triggers control relics, control-triggered sigils (e.g., Severance).
 * If target activating, triggers Ineptitude (interrupt → blind → confusion).
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Control event
 */
export function handleControlEvent(ctx, event) {
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
  if (ctx.config.target?.activatingSkills) {
    triggerIneptitude(
      ctx,
      event,
      "interrupt → blind → confusion",
      applyCondition,
    );
  }
}

/**
 * Handles blind event: triggers Ineptitude (blind → confusion).
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Blind event
 */
export function handleBlindEvent(ctx, event) {
  triggerIneptitude(ctx, event, "blind → confusion", applyCondition);
}

/**
 * Handles Peitha relic event.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Peitha event
 */
export function handlePeithaEvent(ctx, event) {
  handlePeithaRelic(ctx, event, applyCondition);
}

/**
 * Handles condition event: applies condition (damage ticks scheduled).
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Condition event
 */
export function handleConditionEvent(ctx, event) {
  applyCondition(ctx, event);
}

/**
 * Handles condition tick event: calculates damage, updates totals.
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Condition tick event
 */
export function handleConditionTickEvent(ctx, event) {
  handleConditionTick(ctx, event);
}

/**
 * Handles weapon swap event: triggers swap-triggered sigils (e.g., Doom, condition on swap).
 * @param {Object} ctx - Resolver context
 * @param {Object} event - Weapon set event
 */
export function handleWeaponSetEvent(ctx, event) {
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
      });
      recordSigil(ctx, name, event.at, "Swap Weapons");
      continue;
    }
    if (proc.effect === "strike") {
      queueSigilStrike(ctx, name, event.at, proc, "Swap Weapons");
      recordSigil(ctx, name, event.at, "Swap Weapons");
    }
  }
}
