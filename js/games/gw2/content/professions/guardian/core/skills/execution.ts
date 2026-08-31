/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill, replaceSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { guardianVirtueSkillHandlers } from '#gw2/content/professions/guardian/core/mechanics/virtues.js';

export const guardianCoreSkillHandlers = Object.freeze({
  'guardian.virtue': augmentSkill({
    beforeEffects: guardianVirtueSkillHandlers['guardian.virtue']
  }),
  'guardian.renewed-focus': replaceSkill({
    beforeEffects: guardianVirtueSkillHandlers['guardian.renewed-focus']
  }),
  'guardian.weapon-swap': gw2WeaponSwapSkillHandler
});
