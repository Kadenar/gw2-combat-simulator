import {
  addAttribute,
  CONDITION_DURATION_ATTRIBUTES,
  derivedAttribute,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";

function selectedSkill(skills, name) {
  return (skills || []).some(skill => skill?.name === name);
}

export function applyNecromancerBuildAttributeRules(
  common,
  {
    build,
    selectedSkills = [],
    disabledTrait = null,
  },
) {
  const attributes = structuredClone(common.attributes);
  const activeTraits = getActiveTraits(build.specializations || [])
    .filter(trait => trait.name !== disabledTrait);
  const hasTrait = name => activeTraits.some(trait => trait.name === name);
  const traitStats = {};
  const traitDurations = {};

  if (hasTrait("Spiteful Fortitude")) {
    addAttribute(
      traitStats,
      "Vitality",
      attributes.Power.final * 0.1,
    );
  }
  if (hasTrait("Furious Demise")) {
    addAttribute(traitStats, "Precision", 180);
  }
  if (hasTrait("Target the Weak")) {
    addAttribute(
      traitStats,
      "Condition Damage",
      attributes.Precision.final * 0.13,
    );
  }
  if (hasTrait("Lingering Curse")) {
    addAttribute(traitStats, "Condition Damage", 200);
  }
  if (hasTrait("Vital Persistence")) {
    addAttribute(traitStats, "Vitality", 180);
  }
  if (hasTrait("Alchemic Vigor")) {
    addAttribute(traitStats, "Vitality", 240);
  }
  const vitality =
    attributes.Vitality.final + Number(traitStats.Vitality || 0);
  if (hasTrait("Implacable Foe")) {
    addAttribute(traitStats, "Ferocity", vitality * 0.13);
  }
  if (hasTrait("Twisted Medicine")) {
    addAttribute(traitStats, "Concentration", vitality * 0.13);
  }
  if (hasTrait("Dark Gunslinger")) {
    addAttribute(traitStats, "Expertise", vitality * 0.13);
  }
  if (hasTrait("Boon of Creation")) {
    addAttribute(traitStats, "Concentration", 180);
  }
  if (hasTrait("Fell Beacon")) {
    addAttribute(
      traitStats,
      "Expertise",
      (
        attributes["Condition Damage"].final
        + Number(traitStats["Condition Damage"] || 0)
      ) * 0.07,
    );
  }
  if (selectedSkill(selectedSkills, "Signet of Spite")) {
    addAttribute(traitStats, "Power", 180);
  }
  if (hasTrait("Barbed Precision")) {
    traitDurations["Bleeding Duration"] = 20;
  }

  for (const [name, amount] of Object.entries(traitStats)) {
    if (!attributes[name]) continue;
    attributes[name].traits += amount;
    attributes[name].final += amount;
  }

  const {
    runeDurations,
    foodDurations,
    sigilDurations,
    sigilCriticalChance,
  } = common.commonContext;
  const precision = attributes.Precision.final;
  const ferocity = attributes.Ferocity.final;
  const concentration = attributes.Concentration.final;
  const expertise = attributes.Expertise.final;
  attributes["Critical Chance"] = derivedAttribute(
    (precision - 895) / 21 + sigilCriticalChance,
    0,
    sigilCriticalChance,
  );
  attributes["Critical Damage"] = derivedAttribute(150 + ferocity / 15);
  attributes["Boon Duration"] = derivedAttribute(
    concentration / 15
      + (runeDurations["Boon Duration"] || 0)
      + (foodDurations["Boon Duration"] || 0)
      + (sigilDurations["Boon Duration"] || 0),
    0,
    sigilDurations["Boon Duration"] || 0,
    runeDurations["Boon Duration"] || 0,
    foodDurations["Boon Duration"] || 0,
  );
  attributes["Condition Duration"] = derivedAttribute(
    expertise / 15
      + (runeDurations["Condition Duration"] || 0)
      + (foodDurations["Condition Duration"] || 0)
      + (sigilDurations["Condition Duration"] || 0),
    0,
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
    if (!value) continue;
    attributes[key] = derivedAttribute(
      value,
      traitDurations[key] || 0,
      sigilDurations[key] || 0,
      runeDurations[key] || 0,
      foodDurations[key] || 0,
    );
  }
  const { commonContext, ...result } = common;
  return { ...result, attributes, activeTraits };
}
