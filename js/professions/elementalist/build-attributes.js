import { getActiveTraits } from "./data/traits-data.js";
import {
  addAttribute,
  derivedAttribute,
  SPECIFIC_DURATION_ATTRIBUTES,
} from "../../platform/gw2/attributes.js";

function selectedSkill(skills, name) {
  return (skills || []).some(skill => skill?.name === name);
}

export function applyElementalistBuildAttributeRules(
  common,
  { build, selectedSkills = [] },
) {
  const attributes = structuredClone(common.attributes);
  const traitStats = {};
  const traitDurations = {};
  const activeTraits = getActiveTraits(build.specializations || []);
  const hasTrait = name => activeTraits.some(trait => trait.name === name);
  const {
    conversionPool,
    conversionPoolNoFood,
    foodDurations,
    runeDurations,
    sigilCriticalChance,
    sigilDurations,
  } = common.commonContext;

  if (hasTrait("Ferocious Winds")) {
    addAttribute(
      traitStats,
      "Ferocity",
      Math.round((conversionPool.Precision || 0) * 0.07),
    );
  }
  if (hasTrait("Strength of Stone")) {
    addAttribute(
      traitStats,
      "Condition Damage",
      Math.round((conversionPoolNoFood.Toughness || 0) * 0.1),
    );
  }
  if (selectedSkill(selectedSkills, "Signet of Fire")) {
    addAttribute(traitStats, "Precision", 180);
  }

  let traitCriticalChance = 0;
  for (const trait of activeTraits) {
    addAttribute(traitStats, "Condition Damage", trait.conditionDamage);
    addAttribute(traitStats, "Ferocity", trait.ferocity);
    addAttribute(traitStats, "Concentration", trait.concentration);
    addAttribute(traitStats, "Vitality", trait.vitality);
    addAttribute(
      traitDurations,
      "Burning Duration",
      trait.burningDuration,
    );
    addAttribute(
      traitDurations,
      "Bleeding Duration",
      trait.bleedingDuration,
    );
    traitCriticalChance += Number(trait.criticalChance || 0);
  }

  for (const [name, amount] of Object.entries(traitStats)) {
    if (!attributes[name]) continue;
    attributes[name].traits += amount;
    attributes[name].final += amount;
  }

  const precision = attributes.Precision.final;
  const ferocity = attributes.Ferocity.final;
  const concentration = attributes.Concentration.final;
  const expertise = attributes.Expertise.final;
  attributes["Critical Chance"] = derivedAttribute(
    (precision - 895) / 21 + traitCriticalChance + sigilCriticalChance,
    traitCriticalChance,
    sigilCriticalChance,
  );
  attributes["Critical Damage"] = derivedAttribute(150 + ferocity / 15);
  attributes["Boon Duration"] = derivedAttribute(
    concentration / 15
      + (runeDurations["Boon Duration"] || 0)
      + (traitDurations["Boon Duration"] || 0)
      + (foodDurations["Boon Duration"] || 0)
      + (sigilDurations["Boon Duration"] || 0),
    traitDurations["Boon Duration"] || 0,
    sigilDurations["Boon Duration"] || 0,
    runeDurations["Boon Duration"] || 0,
    foodDurations["Boon Duration"] || 0,
  );
  attributes["Condition Duration"] = derivedAttribute(
    expertise / 15
      + (runeDurations["Condition Duration"] || 0)
      + (traitDurations["Condition Duration"] || 0)
      + (foodDurations["Condition Duration"] || 0)
      + (sigilDurations["Condition Duration"] || 0),
    traitDurations["Condition Duration"] || 0,
    sigilDurations["Condition Duration"] || 0,
    runeDurations["Condition Duration"] || 0,
    foodDurations["Condition Duration"] || 0,
  );
  for (const key of SPECIFIC_DURATION_ATTRIBUTES) {
    const value =
      (runeDurations[key] || 0)
      + (traitDurations[key] || 0)
      + (foodDurations[key] || 0)
      + (sigilDurations[key] || 0);
    if (value) {
      attributes[key] = derivedAttribute(
        value,
        traitDurations[key] || 0,
        sigilDurations[key] || 0,
        runeDurations[key] || 0,
        foodDurations[key] || 0,
      );
    } else {
      delete attributes[key];
    }
  }

  const { commonContext, ...result } = common;
  return {
    ...result,
    attributes,
    activeTraits,
    sigils: [...(build.sigils || [])],
  };
}
