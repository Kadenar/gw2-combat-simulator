import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/combat/recharge.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Runtime and palette share the patched singularity delay under permanent player Alacrity. */
export function tempestOverloadDwell(context: unknown): number {
  return (
    transcendentTempestDwell(context, balanceNumberFromContext(context, TRAIT.SINGULARITY, 'duration')) /
    GW2_ALACRITY_RECHARGE_RATE
  );
}

/** The selected trait owns its shortened dwell independently of the baseline singularity policy. */
function transcendentTempestDwell(context: unknown, base: number): number {
  return hasTrait(context, TRAIT.TRANSCENDENT_TEMPEST)
    ? balanceNumberFromContext(context, TRAIT.TRANSCENDENT_TEMPEST, 'duration')
    : base;
}
