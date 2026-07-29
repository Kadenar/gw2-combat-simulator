/**
 * @fileoverview Composes Thief resource, weapon, trait, and delayed-action
 * callbacks into the cast and scheduler contracts used by the shared engine.
 */

import { thiefCastAvailability } from "./availability.js";
import {
  handleSkrittScuffle,
} from "./specific/artifacts.js";
import {
  advanceThiefResources,
  spendThiefResources,
} from "./specific/resources.js";
import {
  handleThievesGuildAttack,
} from "./specific/skills.js";
import {
  updateThiefTraitCastState,
} from "./specific/traits.js";
import {
  updateThiefWeaponState,
} from "./specific/weapon-state.js";

/**
 * Thief resource and profession-state availability rule.
 */
export const thiefCastRules = Object.freeze({
  availability: {
    id: "thief.availability",
    order: 10,
    handler: thiefCastAvailability,
  },
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
    "thief.skritt-scuffle": handleSkrittScuffle,
  }),
});
