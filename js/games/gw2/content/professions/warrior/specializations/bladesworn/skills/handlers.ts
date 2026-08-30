import { augmentSkillHandler, replaceSkillHandler } from '../../../../../../platform/engine/skills/handlers.js';
import {
  enterDragonTrigger,
  enterGunsaber,
  exitGunsaber,
  useArtillerySlash,
  useDragonSlash,
  useOverchargedCartridges
} from '../traits/index.js';

export const bladeswornSkillHandlers = Object.freeze({
  'warrior.gunsaber-enter': augmentSkillHandler(enterGunsaber),
  'warrior.gunsaber-exit': augmentSkillHandler(exitGunsaber),
  'warrior.dragon-trigger': augmentSkillHandler(enterDragonTrigger),
  'warrior.dragon-slash': replaceSkillHandler(useDragonSlash),
  'warrior.artillery-slash': replaceSkillHandler(useArtillerySlash),
  'warrior.overcharged-cartridges': augmentSkillHandler(useOverchargedCartridges)
});
