import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import { gainThiefInitiative } from "../../core/shared.js";
import type { ThiefCastContext } from "../../types.js";

export function applySkrittSwipeTraits(
  context: ThiefCastContext,
  at: number,
): void {
  if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(context, 2, at, "kleptomaniac");
  }
}
