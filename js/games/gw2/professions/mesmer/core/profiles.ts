import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/skills/types.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';

// Clone capacity is shared by every clone-producing skill and has no individual skill owner.
export const MESMER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: 'mesmer.core.resources',
    name: 'Mesmer Clone Resources',
    profileKind: 'mechanic',
    maximumStacks: 3,
    effects: []
  }
]);

/** Capture the selected trait strike and weapon strength for phantasm bonus attacks. */
export function mesmerProfiledTraitDamage(context: unknown, balanceProfileId: SkillId): Partial<StrikeEffect> {
  const profile = requireBalanceProfileFromContext(context, balanceProfileId);
  const strike = requireEffect(profile, 'strike', 'Strike');
  return {
    weaponStrength: profile.weaponStrength === undefined ? undefined : balanceProfileNumber(profile, 'weaponStrength'),
    ...strike,
    name: undefined
  };
}
