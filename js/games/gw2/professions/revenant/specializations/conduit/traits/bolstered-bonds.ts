import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
/**
 * @fileoverview Shared Bolstered Bonds attribute formula for Revenant.
 *
 * This module lives at the profession root because both the build-time stats
 * calculation in build-attributes.js and the combat-time modifier calculation
 * in attribute-rules.js use it. It does not check whether the trait is active
 * or mutate simulation state; callers own those decisions.
 *
 * Build-time calculation uses one copy of the bonuses. Runtime calculation
 * uses the multiplier to add only the copies required by Cosmic Wisdom,
 * avoiding duplication when build attributes are already present.
 */

import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

// Legendary Entity grants every attribute represented by Bolstered Bonds.
const ALL_ATTRIBUTES = Object.freeze([
  'power',
  'precision',
  'toughness',
  'vitality',
  'ferocity',
  'conditionDamage',
  'expertise',
  'concentration',
  'healingPower'
]);

/**
 * Calculates the combined Bolstered Bonds bonuses for the selected legends.
 *
 * Each supported legend contributes its own attribute pair; Legendary Entity
 * contributes every attribute. Legends without a Bolstered Bonds bonus are
 * ignored.
 *
 * Bonuses keyed by runtime attribute name.
 */
export function bolsteredBondsBonuses(
  context: unknown,
  selectedLegendIds: readonly string[] = [],
  multiplier = 1
): Record<string, number> {
  if (!Number(multiplier)) return {};
  const bonuses: Record<string, number> = {};
  const add = (attribute: string, amount: number): void => {
    bonuses[attribute] = Number(bonuses[attribute] || 0) + amount * multiplier;
  };

  for (const legendId of selectedLegendIds) {
    if (legendId === LEGEND.ASSASSIN) {
      const bolsteredBondsProfile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
      add('power', balanceProfileNumber(bolsteredBondsProfile, 'assassinAttributeBonus'));
      add('ferocity', balanceProfileNumber(bolsteredBondsProfile, 'assassinAttributeBonus'));
    } else if (legendId === LEGEND.CENTAUR) {
      const bolsteredBondsProfile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
      add('healingPower', balanceProfileNumber(bolsteredBondsProfile, 'centaurAttributeBonus'));
      add('concentration', balanceProfileNumber(bolsteredBondsProfile, 'centaurAttributeBonus'));
    } else if (legendId === LEGEND.DEMON) {
      const bolsteredBondsProfile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
      add('conditionDamage', balanceProfileNumber(bolsteredBondsProfile, 'demonAttributeBonus'));
      add('expertise', balanceProfileNumber(bolsteredBondsProfile, 'demonAttributeBonus'));
    } else if (legendId === LEGEND.DWARF) {
      const bolsteredBondsProfile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
      add('toughness', balanceProfileNumber(bolsteredBondsProfile, 'dwarfAttributeBonus'));
      add('vitality', balanceProfileNumber(bolsteredBondsProfile, 'dwarfAttributeBonus'));
    } else if (legendId === LEGEND.ENTITY) {
      for (const attribute of ALL_ATTRIBUTES)
        add(
          attribute,
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS), 'entityAttributeBonus')
        );
    }
  }

  return bonuses;
}
