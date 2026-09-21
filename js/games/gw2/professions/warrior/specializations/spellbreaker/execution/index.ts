/** Full Counter uses the shared resource contract; its effects come from the skill profile. */
import { augmentSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { applyWarriorSkillResource } from '#gw2/professions/warrior/family-state.js';

export const spellbreakerSkillHandlers = Object.freeze({
  'warrior.full-counter': augmentSkillHandler(applyWarriorSkillResource)
});
