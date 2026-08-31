/** Registers scheduler-phase skill activations for this module. */
import { mesmerReplaceProfile } from '#gw2/content/professions/mesmer/core/skills/execution.js';

export const virtuosoSkillHandlers = Object.freeze({
  'mesmer.bladesong': mesmerReplaceProfile
});
