/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import type { ElementalistCastContext } from '#gw2/content/professions/elementalist/types.js';
import { applyAltruisticAspect } from '#gw2/content/professions/elementalist/specializations/evoker/traits/index.js';

/**
 * Handler table referenced by `handlerId` on the Evoker meditations; the shared
 * handler appends Altruistic Aspect's boon after the skill's own effects.
 */
export const evokerSkillHandlers = Object.freeze({
  'elementalist.evoker-meditation': augmentSkill<ElementalistCastContext>({
    afterEffects: applyAltruisticAspect
  })
});
