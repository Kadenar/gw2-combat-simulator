import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import type { ThiefCastContext } from '#gw2/content/professions/thief/types.js';
import {
  thiefBalanceProfile,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/content/professions/thief/core/profiles.js';

export function applySkrittSwipeTraits(context: ThiefCastContext, at: number): void {
  if (hasTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(
      context,
      Number(thiefBalanceProfile(context, PROFILE.kleptomaniac)?.resourceGain || 2),
      at,
      'kleptomaniac'
    );
  }
}
