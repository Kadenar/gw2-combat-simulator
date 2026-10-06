import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/combat/recharge.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';
import { transcendentTempestDwell } from '#gw2/professions/elementalist/specializations/tempest/traits/conduits.js';

/** Runtime and palette share the patched singularity delay under permanent player Alacrity. */
export function tempestOverloadDwell(context: unknown): number {
  const profile = requireBalanceProfileFromContext(context, PROFILE.overloads);
  return transcendentTempestDwell(context, balanceProfileNumber(profile, 'initialDelay')) / GW2_ALACRITY_RECHARGE_RATE;
}
