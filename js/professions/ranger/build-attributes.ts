import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";
import type {
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
} from "../../platform/gw2/types.js";
import type { RangerBuild } from "./types.js";

export function applyRangerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  {
    build,
    selectedSkills = [],
    weaponSet = 1,
    disabledTrait = null,
  }: Gw2BuildAttributeRuleContext,
) {
  const rangerBuild = build as RangerBuild;
  const { conversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(
    rangerBuild.specializations || [],
  ).filter((trait) => trait.name !== disabledTrait);
  const hasTrait = (name: string): boolean =>
    activeTraits.some((trait) => trait.name === name);
  const traitStats: Record<string, number> = {};
  const traitDurations: Record<string, number> = {};
  const weapons =
    weaponSet === 2 ? rangerBuild.alternateWeapons : rangerBuild.weapons;
  const soulbeast = rangerBuild.specializations?.some(
    (specialization) => specialization.name === "Soulbeast",
  );

  if (hasTrait("Strider's Strength")) {
    addAttribute(traitStats, "Power", weapons?.includes("Sword") ? 240 : 120);
  }
  if (hasTrait("Honed Axes")) {
    addAttribute(traitStats, "Ferocity", weapons?.includes("Axe") ? 240 : 120);
  }
  if (soulbeast && hasTrait("Pack Alpha")) {
    for (const attribute of [
      "Power",
      "Precision",
      "Toughness",
      "Vitality",
      "Ferocity",
      "Condition Damage",
      "Expertise",
      "Concentration",
      "Healing Power",
    ]) {
      addAttribute(traitStats, attribute, 150);
    }
  }
  if (soulbeast && hasTrait("Pet's Prowess")) {
    addAttribute(traitStats, "Ferocity", 300);
  }
  if (hasTrait("Ambidexterity")) {
    const favored = weapons?.some((weapon) =>
      ["Dagger", "Mace", "Torch"].includes(weapon),
    );
    addAttribute(traitStats, "Condition Damage", favored ? 240 : 120);
  }
  if (hasTrait("Arachnophobia")) addAttribute(traitStats, "Expertise", 150);
  if (hasTrait("Lingering Magic"))
    addAttribute(traitStats, "Concentration", 240);
  if (hasTrait("Natural Fortitude")) addAttribute(traitStats, "Vitality", 240);
  if (hasTrait("Wellspring")) {
    addAttribute(
      traitStats,
      "Healing Power",
      (conversionPool.Power || 0) * 0.07,
    );
  }
  if (hasTrait("Vicious Quarry") && rangerBuild.assumptions?.fury !== false) {
    addAttribute(traitStats, "Ferocity", 250);
  }
  if (selectedSkills.some((skill) => skill.name === "Signet of the Wild")) {
    addAttribute(traitStats, "Ferocity", 180);
  }

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}
