/** Registers scheduler-phase skill activations for this module. */
import { mesmerReplaceProfile } from '#gw2/content/professions/mesmer/core/skills/execution.js';

export const mirageSkillHandlers = Object.freeze({
  'mesmer.mirage-dodge': mesmerReplaceProfile,
  'mesmer.ambush': mesmerReplaceProfile
});
