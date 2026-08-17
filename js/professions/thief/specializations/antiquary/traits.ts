import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import { gainThiefInitiative } from "../../core/shared.js";
import type { ThiefCastContext } from "../../types.js";
import {
  thiefBalanceProfile,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE,
} from "../../core/profiles.js";

export function applySkrittSwipeTraits(
  context: ThiefCastContext,
  at: number,
): void {
  if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(
      context,
      Number(
        thiefBalanceProfile(context, PROFILE.kleptomaniac)?.resourceGain || 2,
      ),
      at,
      "kleptomaniac",
    );
  }
}
