import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  cloneNecromancerAttributes,
  necromancerRuntimeCoreState
} from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Applies Deadly Strength at the original attribute-conversion position. */
export function modifyDeadlyStrengthAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedCarapace = activeStackCount(necromancerRuntimeCoreState(context).carapaceExpiries || [], context.time);
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(necromancerRuntimeCoreState(context).activeMinions || {}).reduce(
        (total: number, count: number) =>
          total +
          (count || 0) *
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLESH_OF_THE_MASTER), 'resourceGain'),
        0
      )
    : 0;
  const carapace = Math.min(
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLESH_OF_THE_MASTER), 'maximumStacks'),
    timedCarapace + minionCarapace
  );

  if (hasTrait(context, TRAIT.DEADLY_STRENGTH) && carapace > 0) {
    const deadlyStrengthProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_STRENGTH);
    const perStack = balanceProfileNumber(deadlyStrengthProfile, 'attributePerStack');
    result.power += carapace * perStack;
    result.conditionDamage += carapace * perStack;
  }
}

/** Minion-owned strikes sample Necromantic Corruption before applying other creature multipliers. */
export function necromanticCorruptionMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.NECROMANTIC_CORRUPTION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.NECROMANTIC_CORRUPTION), 'damageMultiplier')
    : 1;
}
