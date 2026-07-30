/**
 * @fileoverview Registers Guardian-specific skill handlers with the shared
 * scheduler and declares whether each handler augments or replaces the
 * skill's declarative effect list.
 */

import { guardianRadiantForgeSkillHandlers } from "./radiant-forge.js";
import { guardianTomeSkillHandlers } from "./tomes.js";
import { guardianVirtueSkillHandlers } from "./virtues.js";
import { guardianWeaponSkillHandlers } from "./weapon-state.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../../platform/engine/skill-handlers.js";

/**
 * Catalog-facing handler strategies keyed by the `handlerId` values declared
 * in Guardian skill mechanics.
 */
export const guardianSkillHandlers = Object.freeze({
  "guardian.virtue": augmentSkillHandler(
    guardianVirtueSkillHandlers["guardian.virtue"],
  ),
  "guardian.renewed-focus": replaceSkillHandler(
    guardianVirtueSkillHandlers["guardian.renewed-focus"],
  ),
  "guardian.stow-tome": replaceSkillHandler(
    guardianTomeSkillHandlers["guardian.stow-tome"],
  ),
  "guardian.tome-page": augmentSkillHandler(
    guardianTomeSkillHandlers["guardian.tome-page"],
  ),
  "guardian.radiant-forge": replaceSkillHandler(
    guardianRadiantForgeSkillHandlers["guardian.radiant-forge"],
  ),
  "guardian.radiant-weapon": augmentSkillHandler(
    guardianRadiantForgeSkillHandlers["guardian.radiant-weapon"],
  ),
  "guardian.glaring-burst": replaceSkillHandler(
    guardianRadiantForgeSkillHandlers["guardian.glaring-burst"],
  ),
  "guardian.weapon-swap": replaceSkillHandler(
    guardianWeaponSkillHandlers["guardian.weapon-swap"],
  ),
});
