import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/combat/recharge.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

/** Runtime and palette share the patched singularity delay under permanent player Alacrity. */
export function tempestOverloadDwell(context: unknown): number {
  return (
    transcendentTempestDwell(context, balanceNumberFromContext(context, PROFILE.overloads, 'initialDelay')) /
    GW2_ALACRITY_RECHARGE_RATE
  );
}

/** Share the existing overload profile patch target while keeping the selected-trait decision here. */
function transcendentTempestDwell(context: unknown, base: number): number {
  return hasTrait(context, TRAIT.TRANSCENDENT_TEMPEST)
    ? balanceNumberFromContext(context, PROFILE.overloads, 'duration')
    : base;
}
