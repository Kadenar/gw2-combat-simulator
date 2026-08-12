import {
  addAttribute,
  addAttributes,
  createTraitConversionPool,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";
import type { Skill } from "../../platform/engine/types.js";
import type {
  Gw2CommonAttributeResult,
  Gw2BuildAttributeRuleContext,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes,
} from "../../platform/gw2/types.js";
import type { GuardianBuild } from "./types.js";

function selectedSkill(skills: readonly Skill[], name: string): boolean {
  return (skills || []).some((skill) => skill?.name === name);
}

export function applyGuardianBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  {
    build,
    selectedSkills = [],
    weaponSet = 1,
    disabledTrait = null,
  }: Gw2BuildAttributeRuleContext,
): Gw2FinalizedAttributeResult {
  const guardianBuild = build as GuardianBuild;
  const { conversionPool: commonConversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(
    guardianBuild.specializations || [],
  ).filter((trait) => trait.name !== disabledTrait);
  const hasTrait = (name: string): boolean =>
    activeTraits.some((trait) => trait.name === name);
  const traitStats: Gw2NumericAttributes = {};
  const traitConversionStats: Gw2NumericAttributes = {};
  const traitDurations: Gw2NumericAttributes = {};
  const weapons =
    weaponSet === 2 ? guardianBuild.alternateWeapons : guardianBuild.weapons;
  const mainHand = weapons?.[0] || "";
  const offHand = weapons?.[1] || "";

  if (hasTrait("Right-Hand Strength")) {
    addAttribute(traitStats, "Precision", 80);
    if (
      mainHand &&
      mainHand !== "Greatsword" &&
      mainHand !== "Hammer" &&
      mainHand !== "Longbow" &&
      mainHand !== "Spear" &&
      mainHand !== "Staff"
    ) {
      addAttribute(traitStats, "Power", 80);
    }
  }
  if (hasTrait("Zealous Blade")) {
    addAttribute(traitStats, "Power", 120);
    if (mainHand === "Greatsword") {
      addAttribute(traitStats, "Power", 120);
    }
  }
  if (hasTrait("Radiant Power")) {
    addAttribute(traitStats, "Ferocity", 150);
  }
  if (hasTrait("Stalwart Defender") && offHand === "Shield") {
    addAttribute(traitStats, "Toughness", 240);
  }
  if (hasTrait("Honorable Staff")) {
    addAttribute(traitStats, "Concentration", 120);
  }
  if (hasTrait("Defender's Dogma")) {
    addAttribute(traitConversionStats, "Vitality", 180);
  }
  if (hasTrait("Force of Will")) {
    addAttribute(traitConversionStats, "Vitality", 300);
  }
  if (
    hasTrait("Imbued Haste") &&
    guardianBuild.assumptions?.quickness !== false
  ) {
    addAttribute(traitConversionStats, "Condition Damage", 250);
    addAttribute(traitConversionStats, "Healing Power", 250);
    addAttribute(traitConversionStats, "Vitality", 250);
  }
  if (hasTrait("Searing Pact")) {
    addAttribute(traitConversionStats, "Condition Damage", 120);
  }
  if (hasTrait("Power for Power")) {
    addAttribute(traitConversionStats, "Power", 120);
  }
  if (hasTrait("Conceited Curate")) {
    addAttribute(traitConversionStats, "Vitality", 180);
  }
  if (hasTrait("Light's Gift")) {
    addAttribute(traitConversionStats, "Vitality", 180);
  }

  addAttributes(traitStats, traitConversionStats);
  const conversionPool = createTraitConversionPool(
    commonConversionPool,
    traitConversionStats,
  );

  if (hasTrait("Kindled Zeal")) {
    addAttribute(
      traitStats,
      "Condition Damage",
      Math.round((conversionPool.Power || 0) * 0.1),
    );
  }

  const signetMultiplier = hasTrait("Perfect Inscriptions") ? 1.2 : 1;
  if (selectedSkill(selectedSkills, "Bane Signet")) {
    addAttribute(traitStats, "Power", 180 * signetMultiplier);
  }
  if (selectedSkill(selectedSkills, "Signet of Wrath")) {
    addAttribute(traitStats, "Condition Damage", 180 * signetMultiplier);
  }
  if (hasTrait("Power of the Virtuous")) {
    addAttribute(
      traitStats,
      "Condition Damage",
      Math.round((conversionPool.Vitality || 0) * 0.07),
    );
  }

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}
