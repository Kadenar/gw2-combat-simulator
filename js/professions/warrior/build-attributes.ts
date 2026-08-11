import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";
import type {
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes,
} from "../../platform/gw2/types.js";
import type { WarriorSpecializationSelection } from "./data/traits-data.js";

export function applyWarriorBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  {
    build,
    selectedSkills = [],
    disabledTrait = null,
  }: Gw2BuildAttributeRuleContext,
): Gw2FinalizedAttributeResult {
  const { conversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(
    (build.specializations || []) as WarriorSpecializationSelection[],
  ).filter((trait) => trait.name !== disabledTrait);
  const hasTrait = (name: string) =>
    activeTraits.some((trait) => trait.name === name);
  const weapons = [...(build.weapons || []), ...(build.alternateWeapons || [])];
  const traitStats: Gw2NumericAttributes = {};
  const traitDurations: Gw2NumericAttributes = {};

  if (selectedSkills.some((skill) => skill.name === "Signet of Might")) {
    addAttribute(traitStats, "Power", 180);
  }
  if (selectedSkills.some((skill) => skill.name === "Signet of Fury")) {
    addAttribute(traitStats, "Precision", 180);
  }
  if (hasTrait("Forceful Greatsword")) {
    addAttribute(
      traitStats,
      "Power",
      weapons.includes("Greatsword") ? 240 : 120,
    );
  }
  if (hasTrait("Great Fortitude")) {
    const power = conversionPool.Power || 0;
    addAttribute(traitStats, "Vitality", power * 0.1);
    addAttribute(traitStats, "Ferocity", power * 0.1);
  }
  if (hasTrait("Roaring Reveille"))
    addAttribute(traitStats, "Concentration", 120);
  if (hasTrait("Vigorous Shouts")) {
    addAttribute(traitStats, "Healing Power", (conversionPool.Power || 0) * 0.1);
  }
  if (
    hasTrait("Deep Strikes") &&
    Boolean((build.assumptions as Record<string, unknown> | undefined)?.fury)
  )
    addAttribute(traitStats, "Condition Damage", 180);
  if (hasTrait("Wounding Precision")) {
    addAttribute(
      traitStats,
      "Expertise",
      (conversionPool.Precision || 0) * 0.07,
    );
  }
  if (hasTrait("Blademaster")) {
    addAttribute(traitStats, "Expertise", 120);
  }
  if (hasTrait("Axe Mastery")) {
    addAttribute(traitStats, "Ferocity", weapons.includes("Axe") ? 240 : 120);
  }
  if (hasTrait("Inspiring Implements"))
    addAttribute(traitStats, "Concentration", 180);
  if (hasTrait("Bloodlust")) traitDurations["Bleeding Duration"] = 33;
  if (hasTrait("King of Fires")) traitDurations["Burning Duration"] = 33;

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}
