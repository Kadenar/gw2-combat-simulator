/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill, replaceSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import { guardianTomeSkillHandlers } from '#gw2/content/professions/guardian/specializations/firebrand/mechanics/tomes.js';

export const firebrandSkillHandlers = Object.freeze({
  // replaceSkill owns the entire cast (no platform effects run); stowing a
  // tome is pure state bookkeeping with no GW2 skill effects of its own.
  'guardian.stow-tome': replaceSkill({
    beforeEffects: guardianTomeSkillHandlers['guardian.stow-tome']
  }),
  // augmentSkill lets the platform apply the skill's normal hit/condition
  // packets; the beforeEffects hook only handles the page-resource accounting.
  'guardian.tome-page': augmentSkill({
    beforeEffects: guardianTomeSkillHandlers['guardian.tome-page']
  })
});
