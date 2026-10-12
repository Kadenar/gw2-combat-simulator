import { hasTrait } from '#gw2/platform/builds/selected-traits.js';

import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntime } from '#gw2/professions/warrior/types.js';

/** Enduring Refrain scales Might only; other packets retain their original stacks. */
export function enduringRefrainMultiplier(runtime: WarriorRuntime): number {
  return hasTrait(runtime, TRAIT.ENDURING_REFRAIN)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ENDURING_REFRAIN), 'stackMultiplier')
    : 1;
}

/** Chant entry adds the selected trait's Motivation before opening boons. */
export function enduringRefrainMotivation(runtime: WarriorRuntime): number {
  return hasTrait(runtime, TRAIT.ENDURING_REFRAIN)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ENDURING_REFRAIN), 'resourceGain')
    : 0;
}

/** Echo counts are fixed at command admission and survive later trait changes. */
export function reverberationEchoCount(runtime: WarriorRuntime): number {
  return hasTrait(runtime, TRAIT.REVERBERATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.REVERBERATION), 'maximumStacks')
    : 1;
}
