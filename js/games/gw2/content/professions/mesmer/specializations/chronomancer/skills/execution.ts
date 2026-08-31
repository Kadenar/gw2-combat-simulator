/** Registers scheduler-phase skill activations for this module. */
import { mesmerReplaceProfile } from '#gw2/content/professions/mesmer/core/skills/execution.js';

export const chronomancerSkillHandlers = Object.freeze({
  'mesmer.continuum-shift': mesmerReplaceProfile,
  'mesmer.continuum-split': mesmerReplaceProfile
});
