import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Siphon packets apply the same active Soul Barbs window outside ordinary strike modifiers. */
export function soulBarbsSiphonMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.SOUL_BARBS) &&
    runtime.combat.activeBuffStacks('necromancer-soul-barbs', runtime.time, 1) > 0
    ? 1 + balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'damageIncrease')
    : 1;
}
