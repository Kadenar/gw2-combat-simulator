import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { applyAltruisticAspect } from '#gw2/professions/elementalist/specializations/evoker/traits/index.js';
import type { ElementalistCastContext } from '#gw2/professions/elementalist/types.js';

/** Appends Altruistic Aspect after each Evoker meditation's authored effects. */
export const evokerSkillHandlers = Object.freeze({
  'elementalist.evoker-meditation': augmentSkill<ElementalistCastContext>({
    afterEffects: applyAltruisticAspect
  })
});
