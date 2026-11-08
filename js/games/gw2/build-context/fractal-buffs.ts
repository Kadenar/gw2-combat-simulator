/** Apply potion stats after conversions and restrict outgoing damage bonuses to the player. */
import type { BuildAttributes } from '#gw2/build-context/types.js';
import type { Gw2AttributeMap, Gw2AttributeSeed } from '#gw2/platform/attributes/types.js';
import {
  FRACTAL_AUGMENTATIONS,
  fractalAttributes,
  validateFractalBuffs,
  type FractalBuffs
} from '#gw2/platform/builds/fractal-buffs.js';

/** Converted potion stats bypass conversion pools; concentration also contributes its derived boon duration. */
function potionAttributes(attributes: Gw2AttributeMap, bonus: number): Gw2AttributeMap {
  return Object.fromEntries(
    Object.entries(attributes).map(([name, attribute]) => {
      const amount = ['Vitality', 'Toughness', 'Concentration'].includes(name)
        ? bonus
        : name === 'Boon Duration'
          ? bonus / 15
          : 0;
      return [
        name,
        amount
          ? { ...attribute, final: attribute.final + amount, fractalPotions: (attribute.fractalPotions ?? 0) + amount }
          : attribute
      ];
    })
  );
}

/** Add potion stats to final totals while preserving trait and utility conversion sources. */
export function fractalAttributeSeed(seed: Gw2AttributeSeed, buffs?: FractalBuffs): Gw2AttributeSeed {
  validateFractalBuffs(buffs);

  if (!buffs?.enabled) return seed;

  const bonus = fractalAttributes(buffs).Concentration;
  return {
    ...seed,
    commonTotals: {
      ...seed.commonTotals,
      vitality: (seed.commonTotals.vitality ?? 0) + bonus,
      toughness: (seed.commonTotals.toughness ?? 0) + bonus,
      concentration: (seed.commonTotals.concentration ?? 0) + bonus
    },
    sources: potionAttributes(seed.sources, bonus)
  };
}

/** Finalized previews include the same potion contribution as runtime seeds. */
export function applyFractalAttributes(base: BuildAttributes, buffs?: FractalBuffs): BuildAttributes {
  validateFractalBuffs(buffs);

  if (!buffs?.enabled) return base;

  return {
    ...base,
    attributes: potionAttributes(base.attributes, fractalAttributes(buffs).Concentration),
    attributeSeed: fractalAttributeSeed(base.attributeSeed, buffs)
  };
}

/** Fractal damage bonuses affect player strikes and conditions, leaving summon channels unchanged. */
export function fractalDamageModifiers(
  buffs?: FractalBuffs
): { playerStrike: number; playerCondition: number } | undefined {
  validateFractalBuffs(buffs);

  if (!buffs?.enabled) return undefined;

  const damage = 1.15 * (1 + FRACTAL_AUGMENTATIONS[buffs.augmentation].damage);
  return { playerStrike: damage, playerCondition: damage };
}
