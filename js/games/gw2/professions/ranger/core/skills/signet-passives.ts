import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';

/** Selected Signet of the Wild grants ferocity only while ready; callers supply their own observation clock. */
export function signetOfTheWildBonus(context: unknown, selected: boolean, ready = true): number {
  return selected && ready
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.signetOfTheWild), 'attributeBonus')
    : 0;
}
