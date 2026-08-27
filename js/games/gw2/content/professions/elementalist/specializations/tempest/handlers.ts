import { augmentSkill } from '../../../../../integrations/patches/authoring/mechanics.js';
import type { ElementalistCastContext } from '../../types.js';
import { applyTempestShoutTraits } from './rules.js';

export const tempestSkillHandlers = Object.freeze({
  'elementalist.tempest-shout': augmentSkill<ElementalistCastContext>({
    afterEffects: applyTempestShoutTraits
  })
});
