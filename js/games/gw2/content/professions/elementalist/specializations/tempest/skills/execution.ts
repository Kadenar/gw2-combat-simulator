/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import type { ElementalistCastContext } from '#gw2/content/professions/elementalist/types.js';
import { applyTempestShoutTraits } from '#gw2/content/professions/elementalist/specializations/tempest/mechanics/overloads.js';

/**
 * Handler table keyed by the `handlerId` the shout catalog entries declare; the shared shout
 * handler augments (rather than replaces) the catalog effects with Tempestuous Aria's might.
 */
export const tempestSkillHandlers = Object.freeze({
  'elementalist.tempest-shout': augmentSkill<ElementalistCastContext>({
    afterEffects: applyTempestShoutTraits
  })
});
