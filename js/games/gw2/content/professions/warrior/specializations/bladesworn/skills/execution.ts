/** Registers scheduler-phase skill activations for this module. */
import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import {
  enterDragonTrigger,
  enterGunsaber,
  exitGunsaber,
  useArtillerySlash,
  useDragonSlash,
  useOverchargedCartridges
} from '#gw2/content/professions/warrior/specializations/bladesworn/traits/index.js';

export const bladeswornSkillHandlers = Object.freeze({
  'warrior.gunsaber-enter': augmentSkillHandler(enterGunsaber),
  'warrior.gunsaber-exit': augmentSkillHandler(exitGunsaber),
  'warrior.dragon-trigger': augmentSkillHandler(enterDragonTrigger),
  'warrior.dragon-slash': replaceSkillHandler(useDragonSlash),
  'warrior.artillery-slash': replaceSkillHandler(useArtillerySlash),
  'warrior.overcharged-cartridges': augmentSkillHandler(useOverchargedCartridges)
});
