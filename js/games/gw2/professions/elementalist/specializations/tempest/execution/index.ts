import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { applyTempestShoutTraits } from '#gw2/professions/elementalist/specializations/tempest/mechanics/overloads.js';
import type { ElementalistCastContext } from '#gw2/professions/elementalist/types.js';

/** Appends Tempest shout traits after each shout's authored effects. */
export const tempestSkillHandlers = Object.freeze({
  'elementalist.tempest-shout': augmentSkill<ElementalistCastContext>({
    afterEffects: applyTempestShoutTraits
  })
});
