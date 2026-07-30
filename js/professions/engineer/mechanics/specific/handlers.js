import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../../platform/engine/skill-handlers.js";
import {
  activateAmalgamMorph,
  activatePlasmaticState,
  evolveAmalgam,
} from "./amalgam.js";
import {
  scheduleConduitSurge,
  scheduleDevastatorFollowup,
  scheduleElectricArtillery,
  scheduleLightningRod,
  scheduleRoilingSkiesControl,
} from "./spear.js";
import { deployEngineerTurret } from "./turrets.js";
import { engineerKitSkillHandlers } from "./kits.js";
import { engineerFlipSkillHandlers } from "./flips.js";
import {
  activateOverclockSignet,
  engineerMechSkillHandlers,
} from "./mech.js";
import { rechargeOtherSwordSkills } from "./sword.js";
import {
  engineerPhotonForgeSkillHandlers,
} from "./photon-forge.js";
import { performEngineerDodge } from "./dodge.js";

function afterEffects(handler) {
  return augmentSkillHandler(null, { afterEffects: handler });
}

function replaceAfterEffects(handler) {
  return replaceSkillHandler(null, { afterEffects: handler });
}

export const engineerSkillHandlers = Object.freeze({
  "engineer.dodge": replaceSkillHandler(performEngineerDodge),
  "engineer.kit-equip": afterEffects(
    engineerKitSkillHandlers["engineer.kit-equip"],
  ),
  "engineer.kit-stow": afterEffects(
    engineerKitSkillHandlers["engineer.kit-stow"],
  ),
  "engineer.arm-flip": afterEffects(
    engineerFlipSkillHandlers["engineer.arm-flip"],
  ),
  "engineer.consume-flip": afterEffects(
    engineerFlipSkillHandlers["engineer.consume-flip"],
  ),
  "engineer.photon-forge-enter": afterEffects(
    engineerPhotonForgeSkillHandlers["engineer.photon-forge-enter"],
  ),
  "engineer.photon-forge-exit": afterEffects(
    engineerPhotonForgeSkillHandlers["engineer.photon-forge-exit"],
  ),
  "engineer.heat": afterEffects(
    engineerPhotonForgeSkillHandlers["engineer.heat"],
  ),
  "engineer.mech-summon": afterEffects(
    engineerMechSkillHandlers["engineer.mech-summon"],
  ),
  "engineer.mech-recall": afterEffects(
    engineerMechSkillHandlers["engineer.mech-recall"],
  ),
  "engineer.overclock-signet": afterEffects(activateOverclockSignet),
  "engineer.gleam-saber": afterEffects(rechargeOtherSwordSkills),
  "engineer.amalgam-morph": afterEffects(activateAmalgamMorph),
  "engineer.evolve": afterEffects(evolveAmalgam),
  "engineer.plasmatic-state": afterEffects(activatePlasmaticState),
  "engineer.lightning-rod": replaceAfterEffects(scheduleLightningRod),
  "engineer.conduit-surge": replaceAfterEffects(scheduleConduitSurge),
  "engineer.electric-artillery": replaceAfterEffects(
    scheduleElectricArtillery,
  ),
  "engineer.roiling-skies": afterEffects(scheduleRoilingSkiesControl),
  "engineer.turret-deploy": replaceAfterEffects(deployEngineerTurret),
  "engineer.devastator": afterEffects(scheduleDevastatorFollowup),
});
