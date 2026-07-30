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
import type {
  SkillHandlerPhase,
  SkillHandlerStrategy,
} from "../../../../platform/engine/types.js";
import type {
  EngineerCastContext,
  EngineerSkill,
} from "../../types.js";

type EngineerHandler = (
  context: EngineerCastContext,
  skill: EngineerSkill,
) => unknown;

function handlerPhase(
  handler: EngineerHandler,
): SkillHandlerPhase<EngineerCastContext> {
  return (context, skill) => handler(context, skill as EngineerSkill);
}

function afterEffects(
  handler: EngineerHandler,
): Readonly<SkillHandlerStrategy<EngineerCastContext>> {
  return augmentSkillHandler<EngineerCastContext>(
    null as unknown as SkillHandlerPhase<EngineerCastContext>,
    { afterEffects: handlerPhase(handler) },
  );
}

function replaceAfterEffects(
  handler: EngineerHandler,
): Readonly<SkillHandlerStrategy<EngineerCastContext>> {
  return replaceSkillHandler<EngineerCastContext>(
    null as unknown as SkillHandlerPhase<EngineerCastContext>,
    { afterEffects: handlerPhase(handler) },
  );
}

export const engineerSkillHandlers = Object.freeze({
  "engineer.dodge": replaceSkillHandler<EngineerCastContext>(
    handlerPhase(performEngineerDodge),
  ),
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
}) satisfies Readonly<
  Record<string, Readonly<SkillHandlerStrategy<EngineerCastContext>>>
>;
