import { augmentSkillHandler } from '../../../../platform/engine/skill-handlers.js';
import { activateChant, activateCommand } from './traits.js';

export const paragonSkillHandlers = Object.freeze({
  'warrior.chant': augmentSkillHandler(activateChant),
  'warrior.command': augmentSkillHandler(activateCommand)
});
