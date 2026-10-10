import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerConfig, NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

/** Applies Awaken the Pain at the original attribute-conversion position. */
export function modifyAwakenThePainAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    const awakenThePainProfile = requireBalanceProfileFromContext(context, TRAIT.AWAKEN_THE_PAIN);
    const perStack = balanceProfileNumber(awakenThePainProfile, 'attributePerStack');
    result.power += (context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) * perStack;
  }
}

/** Applies Spiteful Fortitude at the original attribute-conversion position. */
export function modifySpitefulFortitudeAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  if (hasTrait(context, TRAIT.SPITEFUL_FORTITUDE)) {
    const spitefulFortitudeProfile = requireBalanceProfileFromContext(context, TRAIT.SPITEFUL_FORTITUDE);
    result.vitality +=
      (context.config?.stats?.power || 0) * balanceProfileNumber(spitefulFortitudeProfile, 'attributeConversion');
  }
}

/** Capacity calculation uses the same common Power conversion as static attribute calculation. */
export function spitefulFortitudeVitality(config: NecromancerConfig, balanceContext: unknown): number {
  return hasTrait(config, TRAIT.SPITEFUL_FORTITUDE)
    ? (config.stats?.power ?? 1000) *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.SPITEFUL_FORTITUDE),
          'attributeConversion'
        )
    : 0;
}

/** Selected signet passives remain active during shroud even while their skill recharges. */
export function signetsOfSufferingPassive(runtime: NecromancerRuntime, inShroud: boolean): boolean {
  return hasTrait(runtime, TRAIT.SIGNETS_OF_SUFFERING) && inShroud;
}
