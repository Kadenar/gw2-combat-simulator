import { SKILL_HANDLER_MODES } from '../../../../../platform/engine/skills/handlers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import type { NecromancerCastContext } from '../../types.js';

// Determines whether the Doom Approaches variant fully replaces or merely augments the base Dark Barrage attack.
// REPLACE is needed when the trait is active so the single-hit base damage is suppressed and only the 8-hit barrage fires.
export function darkBarrageHandlerMode(context: NecromancerCastContext) {
  return hasTrait(context, TRAIT.DOOM_APPROACHES) ? SKILL_HANDLER_MODES.REPLACE : SKILL_HANDLER_MODES.AUGMENT;
}
