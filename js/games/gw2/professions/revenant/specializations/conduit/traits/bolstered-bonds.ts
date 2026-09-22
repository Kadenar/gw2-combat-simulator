import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
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
      add('power', balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'assassinAttributeBonus'));
      add('ferocity', balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'assassinAttributeBonus'));
    } else if (legendId === LEGEND.CENTAUR) {
      add('healingPower', balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'centaurAttributeBonus'));
      add('concentration', balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'centaurAttributeBonus'));
    } else if (legendId === LEGEND.DEMON) {
      add('conditionDamage', balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'demonAttributeBonus'));
      add('expertise', balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'demonAttributeBonus'));
    } else if (legendId === LEGEND.DWARF) {
      add('toughness', balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'dwarfAttributeBonus'));
      add('vitality', balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'dwarfAttributeBonus'));
    } else if (legendId === LEGEND.ENTITY) {
      for (const attribute of ALL_ATTRIBUTES)
        add(attribute, balanceProfileNumberFromContext(context, TRAIT.BOLSTERED_BONDS, 'entityAttributeBonus'));
    }
  }

  return bonuses;
}
