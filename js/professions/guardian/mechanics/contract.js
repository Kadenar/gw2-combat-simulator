import {
  validateGuardianAvailability,
} from "./availability.js";
import {
  advanceRadiantForgeState,
  guardianRadiantForgeEventHandlers,
  validateRadiantForgeCast,
} from "./radiant-forge.js";
import {
  advanceTomeState,
  guardianTomeEventHandlers,
  reactToAshesHit,
  validateTomeCast,
} from "./tomes.js";
import {
  handleVirtueActivation,
  handleVirtueRefresh,
  reactToJusticeHit,
  validateVirtueCast,
} from "./virtues.js";
import {
  updateSpearIlluminationState,
} from "./spear.js";
import {
  updateWeaponCastState,
  validateWeaponState,
} from "./weapon-state.js";

export const guardianCastRules = Object.freeze({
  validateCast: Object.freeze([
    {
      id: "guardian.availability",
      order: 10,
      handler: validateGuardianAvailability,
    },
    {
      id: "guardian.virtues",
      order: 20,
      handler: validateVirtueCast,
    },
    {
      id: "guardian.tomes",
      order: 30,
      handler: validateTomeCast,
    },
    {
      id: "guardian.radiant-forge",
      order: 40,
      handler: validateRadiantForgeCast,
    },
    {
      id: "guardian.weapon-state",
      order: 50,
      handler: validateWeaponState,
    },
  ]),
});

export const guardianSchedulerHooks = Object.freeze({
  advance: Object.freeze([
    {
      id: "guardian.tomes",
      order: 10,
      handler: advanceTomeState,
    },
    {
      id: "guardian.radiant-forge",
      order: 20,
      handler: advanceRadiantForgeState,
    },
  ]),
  afterCast: Object.freeze([
    {
      id: "guardian.weapon-state",
      order: 10,
      handler: updateWeaponCastState,
    },
    {
      id: "guardian.spear",
      order: 20,
      handler: updateSpearIlluminationState,
    },
  ]),
});

export const guardianResolverHooks = Object.freeze({
  eventHandlers: Object.freeze({
    "guardian.virtue-activated": handleVirtueActivation,
    "guardian.virtues-refreshed": handleVirtueRefresh,
    ...guardianTomeEventHandlers,
    ...guardianRadiantForgeEventHandlers,
  }),
  eventReactions: Object.freeze({
    damage: Object.freeze([
      {
        id: "guardian.ashes-of-the-just",
        order: 10,
        handler: reactToAshesHit,
      },
      {
        id: "guardian.justice",
        order: 20,
        handler: reactToJusticeHit,
      },
    ]),
  }),
});
