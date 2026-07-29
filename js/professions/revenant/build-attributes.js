import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { bolsteredBondsBonuses } from "./bolstered-bonds.js";
import { getActiveTraits } from "./data/traits-data.js";

const BUILD_ATTRIBUTE_NAMES = Object.freeze({
  power: "Power",
  precision: "Precision",
  toughness: "Toughness",
  vitality: "Vitality",
  ferocity: "Ferocity",
  conditionDamage: "Condition Damage",
  expertise: "Expertise",
  concentration: "Concentration",
  healingPower: "Healing Power",
});

export function applyRevenantBuildAttributeRules(
  common,
  { build, disabledTrait = null },
) {
  const attributes = common.attributes;
  const activeTraits = getActiveTraits(build.specializations || []).filter(
    (trait) => trait.name !== disabledTrait,
  );
  const hasTrait = (name) => activeTraits.some((trait) => trait.name === name);
  const traitStats = {};
  const traitDurations = {};
  const traitCriticalChance = hasTrait("Brutal Momentum") ? 10 : 0;
  if (hasTrait("Seething Malice")) {
    addAttribute(traitStats, "Condition Damage", 120);
  }
  if (hasTrait("Pact of Pain")) {
    traitDurations["Condition Duration"] = 15;
  }
  if (hasTrait("Yearning Empowerment")) {
    const duration = hasTrait("Numinous Gift") ? 15 : 10;
    for (const condition of [
      "Bleeding",
      "Burning",
      "Confusion",
      "Poison",
      "Torment",
    ]) {
      traitDurations[`${condition} Duration`] = duration;
    }
  }
  if (hasTrait("Life Attunement")) {
    addAttribute(traitStats, "Healing Power", 120);
  }
  if (hasTrait("Reinforced Potency")) {
    addAttribute(traitStats, "Concentration", 240);
  }
  if (hasTrait("Bolstered Bonds")) {
    for (const [attribute, amount] of Object.entries(
      bolsteredBondsBonuses(build.selectedLegends),
    )) {
      addAttribute(traitStats, BUILD_ATTRIBUTE_NAMES[attribute], amount);
    }
  }
  if (hasTrait("Versed in Stone")) {
    addAttribute(
      traitStats,
      "Power",
      Math.round(
        (attributes.Toughness.final + Number(traitStats.Toughness || 0)) * 0.13,
      ),
    );
  }
  if (hasTrait("Life Attunement")) {
    addAttribute(
      traitStats,
      "Concentration",
      Math.round(
        (attributes["Healing Power"].final +
          Number(traitStats["Healing Power"] || 0)) *
          0.07,
      ),
    );
  }
  if (hasTrait("Elevated Compassion")) {
    addAttribute(
      traitStats,
      "Concentration",
      Math.round(
        (attributes.Power.final + Number(traitStats.Power || 0)) * 0.13,
      ),
    );
  }
  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
    traitCriticalChance,
  });
}
