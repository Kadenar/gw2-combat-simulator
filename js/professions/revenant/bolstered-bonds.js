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

import { REVENANT_LEGEND_IDS as LEGEND } from "./data/ids.js";

// Legendary Entity grants every attribute represented by Bolstered Bonds.
const ALL_ATTRIBUTES = Object.freeze([
  "power",
  "precision",
  "toughness",
  "vitality",
  "ferocity",
  "conditionDamage",
  "expertise",
  "concentration",
  "healingPower",
]);

/**
 * Calculates the combined Bolstered Bonds bonuses for the selected legends.
 *
 * Each supported legend contributes its own attribute pair; Legendary Entity
 * contributes every attribute. Legends without a Bolstered Bonds bonus are
 * ignored.
 *
 * @param {readonly string[]} selectedLegendIds Selected Revenant legend IDs.
 * @param {number} multiplier Number of bonus copies to apply.
 * @returns {Record<string, number>} Bonuses keyed by runtime attribute name.
 */
export function bolsteredBondsBonuses(selectedLegendIds = [], multiplier = 1) {
  if (!Number(multiplier)) return {};
  const bonuses = {};
  const add = (attribute, amount) => {
    bonuses[attribute] = Number(bonuses[attribute] || 0) + amount * multiplier;
  };

  for (const legendId of selectedLegendIds) {
    if (legendId === LEGEND.ASSASSIN) {
      add("power", 75);
      add("ferocity", 75);
    } else if (legendId === LEGEND.CENTAUR) {
      add("healingPower", 150);
      add("concentration", 150);
    } else if (legendId === LEGEND.DEMON) {
      add("conditionDamage", 75);
      add("expertise", 75);
    } else if (legendId === LEGEND.DWARF) {
      add("toughness", 150);
      add("vitality", 150);
    } else if (legendId === LEGEND.ENTITY) {
      for (const attribute of ALL_ATTRIBUTES) add(attribute, 75);
    }
  }

  return bonuses;
}
