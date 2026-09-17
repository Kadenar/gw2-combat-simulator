import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { guardianRadiantForgeSkillHandlers } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';

/** Applies Radiant Forge state changes at each skill's required lifecycle phase. */
export const luminarySkillHandlers = Object.freeze({
  'guardian.radiant-forge': replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.radiant-forge']
  }),
  'guardian.radiant-weapon': augmentSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.radiant-weapon']
  }),
  'guardian.glaring-burst': replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.glaring-burst']
  })
});
