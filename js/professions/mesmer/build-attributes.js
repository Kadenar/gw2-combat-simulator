import { getActiveTraits } from "./data/traits-data.js";
import {
  addAttribute,
  CONDITION_DURATION_ATTRIBUTES,
  derivedAttribute,
} from "../../platform/gw2/attributes.js";

export function applyMesmerBuildAttributeRules(
  common,
  {
    build,
    selectedSkills = [],
    disabledTrait = null,
  },
) {
  const attributes = structuredClone(common.attributes);
  const traitStats = {};
  const traitDurations = {};
  const activeTraits = getActiveTraits(build.specializations || [])
    .filter(trait => trait.name !== disabledTrait);
  const hasTrait = name => activeTraits.some(trait => trait.name === name);
  const assumptions = build.assumptions || {};
  const conversionPool = common.commonContext.conversionPool;

  if (hasTrait("Quiet Intensity")) {
    addAttribute(traitStats, "Ferocity", Math.round((conversionPool.Vitality || 0) * 0.1));
  }
  if (hasTrait("Chaotic Persistence") && assumptions.regeneration !== false) {
    addAttribute(traitStats, "Expertise", 100);
    addAttribute(traitStats, "Concentration", 250);
  }
  if (hasTrait("Sharpening Sorrow") && assumptions.fury !== false) {
    addAttribute(traitStats, "Expertise", 150);
  }
  if (selectedSkills.some(skill => skill.id === 10232 || skill.name === "Signet of Domination")) {
    addAttribute(traitStats, "Condition Damage", 180);
  }
  if (selectedSkills.some(skill => skill.id === 10234 || skill.name === "Signet of Midnight")) {
    addAttribute(traitStats, "Expertise", 180);
  }

  let traitCriticalChance = 0;
  for (const trait of activeTraits) {
    if (trait.conditionDamage) {
      addAttribute(traitStats, "Condition Damage", trait.conditionDamage);
    }
    if (trait.ferocity) addAttribute(traitStats, "Ferocity", trait.ferocity);
    if (trait.concentration) {
      addAttribute(traitStats, "Concentration", trait.concentration);
    }
    if (trait.vitality) addAttribute(traitStats, "Vitality", trait.vitality);
    if (trait.confusionDuration) {
      addAttribute(
        traitDurations,
        "Confusion Duration",
        trait.confusionDuration,
      );
    }
    traitCriticalChance += Number(trait.criticalChance || 0);
  }
  if (hasTrait("Quiet Intensity") && assumptions.fury !== false) {
    traitCriticalChance += 15;
  }
  if (hasTrait("Flow of Time") && assumptions.alacrity !== false) {
    traitCriticalChance += 15;
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
  const { runeDurations, foodDurations, sigilDurations, sigilCriticalChance } =
    common.commonContext;
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
  for (const key of CONDITION_DURATION_ATTRIBUTES) {
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
    }
  }
  const { commonContext, ...result } = common;
  return { ...result, attributes, activeTraits };
}
