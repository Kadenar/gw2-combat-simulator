import { ENGINEER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasEngineerTrait } from "../state.js";
import { engineerCastAvailability } from "./availability.js";
import {
  handleEngineerMechAttack,
  initializeEngineerMech,
} from "./specific/mech.js";
import {
  advancePhotonForgeState,
} from "./specific/photon-forge.js";
import {
  updateEngineerWeaponState,
} from "./specific/weapon-state.js";
import {
  handleEngineerTurretAttack,
} from "./specific/turrets.js";
import {
  handleElectricArtilleryExpire,
  handleElectricArtilleryReady,
  handleLightningRodCharge,
} from "./specific/spear.js";

function modifyRechargeDuration(context, duration) {
  const skill = context.skill;
  if (
    skill?.toolbeltParentName
    && hasEngineerTrait(context.config, TRAIT.MECHANIZED_DEPLOYMENT)
  ) {
    return duration * 0.85;
  }
  if (
    skill?.categories?.some(category =>
      String(category).toLowerCase() === "gadget")
    && hasEngineerTrait(context.config, TRAIT.GADGETEER)
  ) {
    return duration * 0.8;
  }
  return duration;
}

export const engineerCastRules = Object.freeze({
  availability: {
    id: "engineer.availability",
    order: 10,
    handler: engineerCastAvailability,
  },
  modifyRechargeDuration,
});

export const engineerSchedulerHooks = Object.freeze({
  initialize: initializeEngineerMech,
  advance: advancePhotonForgeState,
  afterCast: updateEngineerWeaponState,
  taskHandlers: Object.freeze({
    "engineer.mech-attack": handleEngineerMechAttack,
    "engineer.turret-attack": handleEngineerTurretAttack,
    "engineer.lightning-rod-charge": handleLightningRodCharge,
    "engineer.electric-artillery-ready": handleElectricArtilleryReady,
    "engineer.electric-artillery-expire": handleElectricArtilleryExpire,
  }),
});
