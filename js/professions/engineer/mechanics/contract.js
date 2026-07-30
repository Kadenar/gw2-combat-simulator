/**
 * @fileoverview Composes Engineer cast rules, scheduler lifecycle hooks, and
 * typed task handlers into the profession contract consumed by the shared
 * engine.
 */

import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasEngineerTrait } from "../state.js";
import { engineerCastAvailability } from "./availability.js";
import {
  applyEngineerMechCastTraits,
  handleEngineerMechAttack,
  initializeEngineerMech,
  isEngineerMechCommand,
  observeEngineerMechEvent,
} from "./specific/mech.js";
import {
  handleMercurialTendencies,
  observeAmalgamScheduledEvent,
} from "./specific/amalgam.js";
import {
  observeEngineerComboFinisher,
} from "./specific/combos.js";
import {
  advancePhotonForgeState,
  handlePhotonForgeHeat,
  observeHolosmithScheduledEvent,
} from "./specific/photon-forge.js";
import { updateEngineerWeaponState } from "./specific/weapon-state.js";
import { handleEngineerTurretAttack } from "./specific/turrets.js";
import {
  handleElectricArtilleryExpire,
  handleElectricArtilleryReady,
  handleLightningRodCharge,
} from "./specific/spear.js";
import { advanceEngineerResources } from "./specific/resources.js";
import {
  applyEngineerCastTraits,
  isEngineerToolbeltSkill,
  modifyEngineerMaximumAmmo,
} from "./specific/traits.js";

/**
 * Applies Engineer trait recharge modifiers to tool-belt and gadget skills.
 *
 * @param {object} context Recharge-modifier context containing the active
 * skill and build configuration.
 * @param {number} duration Shared-engine recharge duration in seconds.
 * @returns {number} Trait-adjusted recharge duration.
 */
function modifyRechargeDuration(context, duration) {
  const skill = context.skill;
  if (
    isEngineerMechCommand(skill)
    && hasEngineerTrait(context.config, TRAIT.MECH_CORE_JADE_DYNAMO)
  ) {
    return duration * 0.8;
  }
  if (
    isEngineerToolbeltSkill(skill) &&
    hasEngineerTrait(context.config, TRAIT.MECHANIZED_DEPLOYMENT)
  ) {
    return duration * 0.85;
  }
  if (
    skill?.id !== ID.OVERCLOCK_SIGNET
    && skill?.categories?.some(
      (category) => String(category).toLowerCase() === "signet",
    )
  ) {
    const selected = context.config.selectedSkills || [];
    const names = new Set(
      (Array.isArray(selected) ? selected : Object.values(selected))
        .map(String),
    );
    const overclockReadyAt = Number(
      context.state?.cooldowns?.get(ID.OVERCLOCK_SIGNET) || 0,
    );
    const jDrive = hasEngineerTrait(
      context.config,
      TRAIT.MECH_CORE_J_DRIVE,
    );
    if (
      names.has("Overclock Signet")
      && (
        jDrive
        || overclockReadyAt <= Number(context.start || 0)
      )
    ) {
      return duration * (jDrive ? 0.76 : 0.8);
    }
  }
  if (
    skill?.categories?.some(
      (category) => String(category).toLowerCase() === "gadget",
    ) &&
    hasEngineerTrait(context.config, TRAIT.GADGETEER)
  ) {
    return duration * 0.8;
  }
  return duration;
}

/**
 * Engineer cast-availability and recharge hooks registered with the engine.
 */
export const engineerCastRules = Object.freeze({
  availability: {
    id: "engineer.availability",
    order: 10,
    handler: engineerCastAvailability,
  },
  modifyRechargeDuration,
  modifyMaximumAmmo: modifyEngineerMaximumAmmo,
});

/**
 * Engineer scheduler lifecycle hooks and delayed task dispatch table.
 */
export const engineerSchedulerHooks = Object.freeze({
  initialize: initializeEngineerMech,
  onEventScheduled(context, event) {
    observeEngineerMechEvent(context, event);
    observeEngineerComboFinisher(context, event);
    observeAmalgamScheduledEvent(context, event);
    observeHolosmithScheduledEvent(context, event);
  },
  advance: Object.freeze([
    {
      id: "engineer.resources",
      order: 10,
      handler: advanceEngineerResources,
    },
    {
      id: "engineer.photon-forge",
      order: 20,
      handler: advancePhotonForgeState,
    },
  ]),
  afterCast: Object.freeze([
    {
      id: "engineer.weapon-state",
      order: 10,
      handler: updateEngineerWeaponState,
    },
    {
      id: "engineer.traits",
      order: 20,
      handler: applyEngineerCastTraits,
    },
    {
      id: "engineer.mech-traits",
      order: 30,
      handler: applyEngineerMechCastTraits,
    },
  ]),
  taskHandlers: Object.freeze({
    "engineer.mercurial-tendencies": handleMercurialTendencies,
    "engineer.mech-attack": handleEngineerMechAttack,
    "engineer.turret-attack": handleEngineerTurretAttack,
    "engineer.lightning-rod-charge": handleLightningRodCharge,
    "engineer.electric-artillery-ready": handleElectricArtilleryReady,
    "engineer.electric-artillery-expire": handleElectricArtilleryExpire,
    "engineer.photon-forge-heat": handlePhotonForgeHeat,
  }),
});
