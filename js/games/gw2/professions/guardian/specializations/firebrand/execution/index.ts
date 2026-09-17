import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { guardianTomeSkillHandlers } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';

/** Schedules tome effects; shared-page spending runs through the cast-completion hook. */
export const firebrandSkillHandlers = Object.freeze({
  'guardian.stow-tome': replaceSkill({
    beforeEffects: guardianTomeSkillHandlers['guardian.stow-tome']
  }),
  'guardian.tome-page': augmentSkill({
    beforeEffects: guardianTomeSkillHandlers['guardian.tome-page']
  })
});
