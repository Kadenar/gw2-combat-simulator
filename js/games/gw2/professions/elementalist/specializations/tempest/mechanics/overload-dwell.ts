import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/engine/skills/recharge.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

/** Runtime and palette share the patched singularity delay under permanent player Alacrity. */
export function tempestOverloadDwell(context: unknown): number {
  const profile = requireBalanceProfileFromContext(context, PROFILE.overloads);
  return (
    balanceProfileNumber(
      profile,
      hasTrait(context, TRAIT.TRANSCENDENT_TEMPEST) ? 'durationMultiplier' : 'initialDelay'
    ) / GW2_ALACRITY_RECHARGE_RATE
  );
}
