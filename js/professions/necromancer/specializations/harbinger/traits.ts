import { SKILL_HANDLER_MODES } from "../../../../platform/engine/skill-handlers.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasTrait } from "../../core/shared.js";
import type { NecromancerCastContext } from "../../types.js";

export function darkBarrageHandlerMode(context: NecromancerCastContext) {
  return hasTrait(context, TRAIT.DOOM_APPROACHES)
    ? SKILL_HANDLER_MODES.REPLACE
    : SKILL_HANDLER_MODES.AUGMENT;
}
