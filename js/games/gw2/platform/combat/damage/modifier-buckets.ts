import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers/types.js';

interface AdditiveDamageBucketOptions {
  readonly damageType?: 'strike' | 'condition';
  readonly bonus?: number;
  readonly includeSigil?: boolean;
}

function additiveSigil(
  context: Gw2ModifierContext,
  damageType: 'strike' | 'condition'
): {
  readonly factor: number;
  readonly sigilBonus: number;
  readonly equipmentBonus: number;
} {
  const sigils = context.timeline?.activeSigilSetAt(context.time) || {};
  const factorValue = damageType === 'condition' ? sigils.condition : sigils.strike;
  const bonusValue = damageType === 'condition' ? sigils.conditionAdd : sigils.strikeAdd;
  const equipmentBonus = Number(context.damageAdditiveBonus || 0);
  const sigilFactor = Number(factorValue || 1);
  const factor = Math.max(Number.EPSILON, sigilFactor + equipmentBonus);
  const configuredBonus = Number(bonusValue);
  return {
    factor,
    sigilBonus: Number.isFinite(configuredBonus) ? configuredBonus : sigilFactor - 1,
    equipmentBonus
  };
}

/**
 * Rebuilds GW2's additive outgoing-damage bucket after the active sigil
 * factor has already been included in the platform multiplier.
 */
export function applyAdditiveDamageBucket(
  context: Gw2ModifierContext,
  multiplier: number,
  { damageType = 'strike', bonus = 0, includeSigil = true }: AdditiveDamageBucketOptions = {}
): number {
  const sigil = additiveSigil(context, damageType);
  return (
    (Number(multiplier || 1) / sigil.factor) *
    (1 + (includeSigil ? sigil.sigilBonus : 0) + sigil.equipmentBonus + Number(bonus || 0))
  );
}
