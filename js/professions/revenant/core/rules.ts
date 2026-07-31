/**
 * @fileoverview Composes Revenant Energy, weapon, trait, and upkeep
 * callbacks into the cast and scheduler contracts used by the shared engine.
 */

import { revenantCastAvailability } from "./availability.js";
import {
  advanceRevenantEnergy,
  spendRevenantEnergy,
} from "./energy.js";
import { handleRevenantUpkeepPulse } from "./upkeep.js";
import { completeRevenantFollowup } from "./followups.js";
import {
  beginRevenantWeaponCast,
  completeRevenantWeaponCast,
  expireImperialGuard,
  updateRevenantWeaponState,
} from "./weapon-state.js";
import {
  afterRevenantCast,
  handleImpossibleOddsStrike,
  initializeRevenantTraits,
  modifyRevenantCastDuration,
  modifyRevenantRechargeDuration,
  observeRevenantEvent,
} from "./traits.js";
import {
  advanceRevenantSpearState,
  handleAbyssalRazeRechargeReduction,
  handleCrushingAbyssGain,
  handleCrushingAbyssWeaponSwap,
  observeRevenantSpearEvent,
} from "./spear.js";
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../types.js";

/**
 * Pays the skill's Energy cost and captures weapon state at cast start.
 *
 * @param {object} context Scheduler cast-start context.
 * @param {object} skill Skill beginning its cast.
 * @returns {void}
 */
function onCastStart(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  spendRevenantEnergy(context, skill);
  beginRevenantWeaponCast(context, skill);
}

/**
 * Commits completion-gated Core weapon mechanics.
 *
 * @param {object} context Scheduler cast-completion context.
 * @param {object} skill Completed skill.
 * @returns {void}
 */
function onCastComplete(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  completeRevenantFollowup(context, skill);
  completeRevenantWeaponCast(context, skill);
}

/**
 * Updates weapon transitions before applying general Revenant after-cast
 * trait reactions.
 *
 * @param {object} context Scheduler after-cast context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
function afterCast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  updateRevenantWeaponState(context, skill);
  afterRevenantCast(context, skill);
}

function advance(
  context: RevenantSchedulerContext,
  time: number,
): void {
  advanceRevenantEnergy(context, time);
  advanceRevenantSpearState(context, time);
}

function onEventScheduled(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  observeRevenantSpearEvent(context, event);
  observeRevenantEvent(context, event);
}

/**
 * Revenant availability, cast-duration, and recharge-duration rules.
 */
export const revenantCastRules = Object.freeze({
  availability: {
    id: "revenant.availability",
    order: 10,
    handler: revenantCastAvailability,
  },
  modifyCastDuration: modifyRevenantCastDuration,
  modifyRechargeDuration: modifyRevenantRechargeDuration,
});

/**
 * Revenant scheduler lifecycle hooks and typed task dispatch table.
 */
export const revenantSchedulerHooks = Object.freeze({
  initialize: initializeRevenantTraits,
  advance,
  onCastStart,
  onCastComplete,
  afterCast,
  /**
   * Makes legend swap immediately available after a global cooldown reset.
   *
   * @param {object} context Scheduler cooldown-reset context.
   * @returns {void}
   */
  onCooldownReset: (context: RevenantSchedulerContext): void => {
    context.state.profession.legendSwapReadyAt = context.state.time;
  },
  onEventScheduled,
  taskHandlers: Object.freeze({
    "revenant.abyssal-raze-recharge":
      handleAbyssalRazeRechargeReduction,
    "revenant.crushing-abyss-gain": handleCrushingAbyssGain,
    "revenant.crushing-abyss-weapon-swap":
      handleCrushingAbyssWeaponSwap,
    "revenant.upkeep-pulse": handleRevenantUpkeepPulse,
    "revenant.imperial-guard-expire": expireImperialGuard,
    "revenant.impossible-odds-strike": handleImpossibleOddsStrike,
  }),
});
