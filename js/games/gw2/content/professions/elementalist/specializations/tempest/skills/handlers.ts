import { augmentSkill } from '../../../../../../integrations/patches/authoring/mechanics.js';
import type { ElementalistCastContext } from '../../../types.js';
import { applyTempestShoutTraits } from '../mechanics/overloads.js';

export const tempestSkillHandlers = Object.freeze({
  'elementalist.tempest-shout': augmentSkill<ElementalistCastContext>({
    afterEffects: applyTempestShoutTraits
  })
});
