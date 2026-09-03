import { SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { NecromancerCastContext } from '#gw2/professions/necromancer/types.js';

/** Selects replacement mode when Doom Approaches suppresses Dark Barrage's base single-hit packet. */
export function darkBarrageHandlerMode(context: NecromancerCastContext) {
  return hasTrait(context, TRAIT.DOOM_APPROACHES) ? SKILL_HANDLER_MODES.REPLACE : SKILL_HANDLER_MODES.AUGMENT;
}
