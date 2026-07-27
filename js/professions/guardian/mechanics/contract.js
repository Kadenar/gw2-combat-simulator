import { validateGuardianAvailability } from "./availability.js";
import {
  advanceRadiantForgeState,
  clearRadiantForgeEntryCooldown,
  validateRadiantForgeCast,
} from "./specific/radiant-forge.js";
import { advanceTomeState, validateTomeCast } from "./specific/tomes.js";
import { validateVirtueCast } from "./specific/virtues.js";
import { updateSpearIlluminationState } from "./specific/spear.js";
import {
  updateWeaponCastState,
  validateWeaponState,
} from "./specific/weapon-state.js";
import {
  observeGuardianScheduledEvent,
  updateGuardianTraitCastState,
} from "./specific/traits.js";

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
    {
      id: "guardian.traits",
      order: 30,
      handler: updateGuardianTraitCastState,
    },
  ]),
  onCastComplete: Object.freeze([
    {
      id: "guardian.radiant-forge",
      order: 10,
      handler: clearRadiantForgeEntryCooldown,
    },
  ]),
  onEventScheduled: Object.freeze([
    {
      id: "guardian.traits",
      order: 10,
      handler: observeGuardianScheduledEvent,
    },
  ]),
});
