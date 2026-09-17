import { augmentSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import {
  activateChant,
  activateCommand
} from '#gw2/professions/warrior/specializations/paragon/mechanics/chants-and-commands.js';

/** Appends Paragon chant and command mechanics, including trait additions, to their native casts. */
export const paragonSkillHandlers = Object.freeze({
  'warrior.chant': augmentSkillHandler(activateChant),
  'warrior.command': augmentSkillHandler(activateCommand)
});
