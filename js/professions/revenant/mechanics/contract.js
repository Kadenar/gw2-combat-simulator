/**
 * @fileoverview Composes Revenant Energy, weapon, trait, Conduit, and upkeep
 * callbacks into the cast and scheduler contracts used by the shared engine.
 */

import { revenantCastAvailability } from "./availability.js";
import {
  advanceRevenantEnergy,
  spendRevenantEnergy,
} from "./specific/energy.js";
import { handleRevenantUpkeepPulse } from "./specific/upkeep.js";
import {
  beginRevenantWeaponCast,
  completeRevenantWeaponCast,
  expireImperialGuard,
  updateRevenantWeaponState,
} from "./specific/weapon-state.js";
import {
  afterRevenantCast,
  initializeRevenantTraits,
  modifyRevenantCastDuration,
  modifyRevenantRechargeDuration,
  observeRevenantEvent,
} from "./specific/traits.js";
import {
  completeBeguilingHaze,
  handleConduitAffinityHit,
} from "./specific/conduit.js";
import { completeRevenantFollowup } from "./specific/followups.js";
import {
  advanceRevenantSpearState,
  handleAbyssalRazeRechargeReduction,
  handleCrushingAbyssGain,
  handleCrushingAbyssWeaponSwap,
  observeRevenantSpearEvent,
} from "./specific/spear.js";

/**
 * Pays the skill's Energy cost and captures weapon state at cast start.
 *
 * @param {object} context Scheduler cast-start context.
 * @param {object} skill Skill beginning its cast.
 * @returns {void}
 */
function onCastStart(context, skill) {
  spendRevenantEnergy(context, skill);
  beginRevenantWeaponCast(context, skill);
}

/**
 * Commits completion-gated Conduit and weapon mechanics.
 *
 * @param {object} context Scheduler cast-completion context.
 * @param {object} skill Completed skill.
 * @returns {void}
 */
function onCastComplete(context, skill) {
  completeBeguilingHaze(context, skill);
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
function afterCast(context, skill) {
  updateRevenantWeaponState(context, skill);
  afterRevenantCast(context, skill);
}

function advance(context, time) {
  advanceRevenantEnergy(context, time);
  advanceRevenantSpearState(context, time);
}

function onEventScheduled(context, event) {
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
   * Makes legend swap and Beguiling Haze immediately available after a global
   * cooldown reset.
   *
   * @param {object} context Scheduler cooldown-reset context.
   * @returns {void}
   */
  onCooldownReset: (context) => {
    context.state.profession.legendSwapReadyAt = context.state.time;
    context.state.profession.beguilingHazeReadyAt = context.state.time;
  },
  onEventScheduled,
  taskHandlers: Object.freeze({
    "revenant.affinity-hit": handleConduitAffinityHit,
    "revenant.abyssal-raze-recharge":
      handleAbyssalRazeRechargeReduction,
    "revenant.crushing-abyss-gain": handleCrushingAbyssGain,
    "revenant.crushing-abyss-weapon-swap":
      handleCrushingAbyssWeaponSwap,
    "revenant.upkeep-pulse": handleRevenantUpkeepPulse,
    "revenant.imperial-guard-expire": expireImperialGuard,
  }),
});
