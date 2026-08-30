/** Registers scheduler-phase skill activations for this module. */
import { mesmerReplaceProfile } from '#gw2/content/professions/mesmer/core/skills/execution.js';

export const troubadourSkillHandlers = Object.freeze({
  'mesmer.instrument': mesmerReplaceProfile,
  'mesmer.crescendo': mesmerReplaceProfile
});
