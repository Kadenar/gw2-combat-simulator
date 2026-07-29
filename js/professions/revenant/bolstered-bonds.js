import { REVENANT_LEGEND_IDS as LEGEND } from "./data/ids.js";

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

export function bolsteredBondsBonuses(selectedLegendIds = [], multiplier = 1) {
  if (!Number(multiplier)) return {};
  const bonuses = {};
  const add = (attribute, amount) => {
    bonuses[attribute] =
      Number(bonuses[attribute] || 0) + amount * multiplier;
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
