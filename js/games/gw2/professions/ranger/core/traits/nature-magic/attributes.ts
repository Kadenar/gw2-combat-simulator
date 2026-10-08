import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2NumericStatKey, Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerModifierContext } from '#gw2/professions/ranger/types.js';

/** Applies the trait contribution at the shared attribute reconciliation boundary. */
export function applyWellspringPlayerAttributes(
  context: Gw2ModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void
): void {
  if (hasTrait(context, TRAIT.WELLSPRING))
    adjust(
      'healingPower',
      (context.config?.stats?.power || 0) *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WELLSPRING), 'attributeConversion')
    );
}

/** Applies the trait contribution at the shared attribute reconciliation boundary. */
export function applyLingeringMagicAttributes(
  context: Gw2ModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void
): void {
  if (hasTrait(context, TRAIT.LINGERING_MAGIC))
    adjust(
      'concentration',
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LINGERING_MAGIC), 'attributeBonus')
    );
}

/** Replaces the player's calculated Wellspring conversion with the pet's actual power. */
export function applyWellspringPetAttributes(
  context: RangerModifierContext,
  result: Gw2ResolvedStats,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void,
  staticRulesApplied: boolean
): void {
  if (!hasTrait(context, TRAIT.WELLSPRING)) return;
  const wellspringProfile = requireBalanceProfileFromContext(context, TRAIT.WELLSPRING);
  const conversion = balanceProfileNumber(wellspringProfile, 'attributeConversion');
  if (staticRulesApplied) adjust('healingPower', -(context.config?.stats?.power || 0) * conversion);
  const summonBasePower = Number(context.event?.summonBasePower);
  const petPower =
    Number.isFinite(summonBasePower) && summonBasePower > 0
      ? summonBasePower +
        (context.query?.mightStacksAt(context.time, context.runtime || undefined, context.event || undefined) || 0) * 30
      : result.power || 0;
  adjust('healingPower', petPower * conversion);
}
