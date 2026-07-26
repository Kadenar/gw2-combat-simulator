import { getActiveTraits } from "./data/traits-data.js";
import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";

export function applyMesmerBuildAttributeRules(
  common,
  {
    build,
    selectedSkills = [],
    disabledTrait = null,
  },
) {
  const attributes = common.attributes;
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

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
    traitCriticalChance,
  });
}
