import { augmentSkill, replaceSkill } from '../../../../platform/gw2/authoring/mechanics.js';
import { guardianRadiantForgeSkillHandlers } from './radiant-forge.js';

export const luminarySkillHandlers = Object.freeze({
  // replaceSkill: the forge transition owns the full cast; declared skill
  // effects from the catalog must not also fire (hence replace, not augment).
  'guardian.radiant-forge': replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.radiant-forge']
  }),
  // augmentSkill: declared effects (damage packets) run normally; beforeEffects
  // only applies the weapon-equip state changes on top of them.
  'guardian.radiant-weapon': augmentSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.radiant-weapon']
  }),
  // replaceSkill: Glaring Burst emits its own strike with a weapon-gated
  // coefficient; the catalog entry has no independent effects to preserve.
  'guardian.glaring-burst': replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.glaring-burst']
  })
});
