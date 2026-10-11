import { hasTrait } from '#gw2/platform/builds/selected-traits.js';

import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Selected signet passives remain active during shroud even while their skill recharges. */
export function signetsOfSufferingPassive(runtime: NecromancerRuntime, inShroud: boolean): boolean {
  return hasTrait(runtime, TRAIT.SIGNETS_OF_SUFFERING) && inShroud;
}
