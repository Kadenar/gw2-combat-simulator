import {
  engineerAfterEffects,
  engineerReplace,
  engineerReplaceAfterEffects,
} from "./handler-strategies.js";
import { performEngineerDodge } from "./dodge.js";
import { engineerFlipSkillHandlers } from "./flips.js";
import { engineerKitSkillHandlers } from "./kits.js";
import {
  scheduleConduitSurge,
  scheduleDevastatorFollowup,
  scheduleElectricArtillery,
  scheduleLightningRod,
  scheduleRoilingSkiesControl,
} from "./spear.js";
import { rechargeOtherSwordSkills } from "./sword.js";
import { deployEngineerTurret } from "./turrets.js";
import {
  engineerCoreResolverEventHandlers,
  engineerCoreResolverEventReactions,
} from "./resolver.js";

export const engineerCoreSkillHandlers = Object.freeze({
  "engineer.dodge": engineerReplace(performEngineerDodge),
  "engineer.kit-equip": engineerAfterEffects(
    engineerKitSkillHandlers["engineer.kit-equip"],
  ),
  "engineer.kit-stow": engineerAfterEffects(
    engineerKitSkillHandlers["engineer.kit-stow"],
  ),
  "engineer.arm-flip": engineerAfterEffects(
    engineerFlipSkillHandlers["engineer.arm-flip"],
  ),
  "engineer.consume-flip": engineerAfterEffects(
    engineerFlipSkillHandlers["engineer.consume-flip"],
  ),
  "engineer.gleam-saber": engineerAfterEffects(rechargeOtherSwordSkills),
  "engineer.lightning-rod": engineerReplaceAfterEffects(
    scheduleLightningRod,
  ),
  "engineer.conduit-surge": engineerReplaceAfterEffects(
    scheduleConduitSurge,
  ),
  "engineer.electric-artillery": engineerReplaceAfterEffects(
    scheduleElectricArtillery,
  ),
  "engineer.roiling-skies": engineerAfterEffects(
    scheduleRoilingSkiesControl,
  ),
  "engineer.turret-deploy": engineerReplaceAfterEffects(
    deployEngineerTurret,
  ),
  "engineer.devastator": engineerAfterEffects(
    scheduleDevastatorFollowup,
  ),
});

export const engineerCoreEventHandlers =
  engineerCoreResolverEventHandlers;
export const engineerCoreEventReactions =
  engineerCoreResolverEventReactions;
