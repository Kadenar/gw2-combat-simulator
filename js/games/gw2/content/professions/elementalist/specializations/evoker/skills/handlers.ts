import { augmentSkill } from '../../../../../../integrations/patches/authoring/mechanics.js';
import type { ElementalistCastContext } from '../../../types.js';
import { applyAltruisticAspect } from '../traits/index.js';

export const evokerSkillHandlers = Object.freeze({
  'elementalist.evoker-meditation': augmentSkill<ElementalistCastContext>({
    afterEffects: applyAltruisticAspect
  })
});
