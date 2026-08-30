import { augmentSkillHandler } from '../../../../../../platform/engine/skills/handlers.js';
import { activateChant, activateCommand } from '../traits/index.js';

export const paragonSkillHandlers = Object.freeze({
  'warrior.chant': augmentSkillHandler(activateChant),
  'warrior.command': augmentSkillHandler(activateCommand)
});
