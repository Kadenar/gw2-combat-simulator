/**
 * @fileoverview Composes Thief resource, weapon, trait, and delayed-action
 * callbacks into the cast and scheduler contracts used by the shared engine.
 */

import { thiefCastAvailability } from "./availability.js";
import {
  handleForgedSurfer,
  handleSkrittScuffle,
} from "./specific/artifacts.js";
import {
  advanceThiefResources,
  spendThiefResources,
} from "./specific/resources.js";
import {
  handleCaltropsPulse,
  handleThousandNeedlesPulse,
} from "./specific/condition-antiquary.js";
import { hasThiefTrait } from "../state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  handleThievesGuildAttack,
} from "./specific/skills.js";
import {
  updateThiefTraitCastState,
} from "./specific/traits.js";
import {
  updateThiefWeaponState,
} from "./specific/weapon-state.js";

function modifyThiefRechargeDuration(context, duration) {
  const skill = context.skill;
  const state = context.state.profession;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (
    skill.usableWhileRecharging === true
    && readyAt > context.start + Number(context.epsilon || 0.0001)
  ) {
    return 0;
  }
  let result = duration;
  if (
    [
      ID.STEAL,
      ID.DEADEYES_MARK,
      ID.SIPHON,
      ID.SKRITT_SWIPE,
    ].includes(skill.id)
  ) {
    if (hasThiefTrait(context.config, TRAIT.LEAD_ATTACKS)) result *= 0.85;
    if (hasThiefTrait(context.config, TRAIT.SLEIGHT_OF_HAND)) result *= 0.8;
  }
  const holoExpirations = (
    state.holoUtilityCooldownReductionExpirations || []
  ).filter(expiresAt => Number(expiresAt) > context.start);
  state.holoUtilityCooldownReductionExpirations = holoExpirations;
  if (skill.type === "Utility" && holoExpirations.length > 0) {
    result *= 0.2;
    holoExpirations.shift();
    state.holoUtilityCooldownReduction = holoExpirations.length ? 0.8 : 0;
    state.holoUtilityCooldownReductionExpiresAt = holoExpirations.length
      ? Math.max(...holoExpirations)
      : 0;
  }
  return result;
}

/**
 * Thief resource and profession-state availability rule.
 */
export const thiefCastRules = Object.freeze({
  availability: {
    id: "thief.availability",
    order: 10,
    handler: thiefCastAvailability,
  },
  modifyRechargeDuration: modifyThiefRechargeDuration,
});

/**
 * Thief scheduler lifecycle hooks and typed task dispatch table.
 *
 * Weapon state updates before trait state after each cast so trait reactions
 * observe the completed weapon transition.
 */
export const thiefSchedulerHooks = Object.freeze({
  advance: advanceThiefResources,
  onCastStart: spendThiefResources,
  afterCast: Object.freeze([
    {
      id: "thief.weapon-state",
      order: 10,
      handler: updateThiefWeaponState,
    },
    {
      id: "thief.traits",
      order: 20,
      handler: updateThiefTraitCastState,
    },
  ]),
  taskHandlers: Object.freeze({
    "thief.thieves-guild-attack": handleThievesGuildAttack,
    "thief.forged-surfer": handleForgedSurfer,
    "thief.skritt-scuffle": handleSkrittScuffle,
    "thief.thousand-needles-pulse": handleThousandNeedlesPulse,
    "thief.caltrops-pulse": handleCaltropsPulse,
  }),
});
