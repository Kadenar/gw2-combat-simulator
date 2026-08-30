/** Registers scheduler-phase skill activations for this module. */
import { augmentSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import {
  activateChant,
  activateCommand
} from '#gw2/content/professions/warrior/specializations/paragon/traits/index.js';

export const paragonSkillHandlers = Object.freeze({
  'warrior.chant': augmentSkillHandler(activateChant),
  'warrior.command': augmentSkillHandler(activateCommand)
});
