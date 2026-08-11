import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { bolsteredBondsBonuses } from "./bolstered-bonds.js";
import { getActiveTraits } from "./data/traits-data.js";
import type {
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes,
} from "../../platform/gw2/types.js";
import type { RevenantBuild } from "./types.js";

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
  common: Gw2CommonAttributeResult,
  { build, disabledTrait = null }: Gw2BuildAttributeRuleContext,
): Gw2FinalizedAttributeResult {
  const revenantBuild = build as RevenantBuild;
  const { conversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(revenantBuild.specializations || []).filter(
    (trait) => trait.name !== disabledTrait,
  );
  const hasTrait = (name: string): boolean =>
    activeTraits.some((trait) => trait.name === name);
  const traitStats: Gw2NumericAttributes = {};
  const traitDurations: Gw2NumericAttributes = {};
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
  if (hasTrait("Empire Divided")) {
    addAttribute(
      traitStats,
      "Power",
      Number(
        revenantBuild.assumptions?.playerHealthFraction ??
          revenantBuild.playerHealthFraction ??
          1,
      ) > 0.5
        ? 240
        : 0,
    );
  }
  if (hasTrait("Bolstered Bonds")) {
    for (const [attribute, amount] of Object.entries(
      bolsteredBondsBonuses(revenantBuild.selectedLegends),
    )) {
      addAttribute(
        traitStats,
        BUILD_ATTRIBUTE_NAMES[attribute as keyof typeof BUILD_ATTRIBUTE_NAMES],
        amount,
      );
    }
  }
  if (hasTrait("Versed in Stone")) {
    addAttribute(
      traitStats,
      "Power",
      Math.round((conversionPool.Toughness || 0) * 0.13),
    );
  }
  if (hasTrait("Life Attunement")) {
    addAttribute(
      traitStats,
      "Concentration",
      Math.round((conversionPool["Healing Power"] || 0) * 0.07),
    );
  }
  if (hasTrait("Elevated Compassion")) {
    addAttribute(
      traitStats,
      "Concentration",
      Math.round((conversionPool.Power || 0) * 0.13),
    );
  }
  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
    traitCriticalChance,
  });
}
