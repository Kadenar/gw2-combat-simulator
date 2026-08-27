import { THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { gainThiefInitiative } from '../../core/shared.js';
import type { ThiefCastContext } from '../../types.js';
import { thiefBalanceProfile, THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '../../core/profiles.js';

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
