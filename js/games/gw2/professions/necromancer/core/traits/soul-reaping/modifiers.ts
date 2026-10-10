import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Apply Soul Reaping attribute and siphon bonuses at their existing modifier boundaries. */

/** Applies Vital Persistence at the original attribute-conversion position. */
export function modifyVitalPersistenceAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.VITAL_PERSISTENCE)) {
    const vitalPersistenceProfile = requireBalanceProfileFromContext(context, TRAIT.VITAL_PERSISTENCE);
    result.vitality += balanceProfileNumber(vitalPersistenceProfile, 'attributeBonus');
  }
}

/** Siphon packets apply the same active Soul Barbs window outside ordinary strike modifiers. */
export function soulBarbsSiphonMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.SOUL_BARBS) &&
    runtime.combat.activeBuffStacks('necromancer-soul-barbs', runtime.time, 1) > 0
    ? 1 + balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'damageIncrease')
    : 1;
}
