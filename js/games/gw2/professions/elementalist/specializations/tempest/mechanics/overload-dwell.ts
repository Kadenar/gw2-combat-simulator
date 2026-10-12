import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/combat/recharge.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

/** Runtime and palette share the patched singularity delay under permanent player Alacrity. */
export function tempestOverloadDwell(context: unknown): number {
  const profile = requireBalanceProfileFromContext(context, PROFILE.overloads);
  return transcendentTempestDwell(context, balanceProfileNumber(profile, 'initialDelay')) / GW2_ALACRITY_RECHARGE_RATE;
}

/** Share the existing overload profile patch target while keeping the selected-trait decision here. */
function transcendentTempestDwell(context: unknown, base: number): number {
  return hasTrait(context, TRAIT.TRANSCENDENT_TEMPEST)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.overloads), 'durationMultiplier')
    : base;
}
