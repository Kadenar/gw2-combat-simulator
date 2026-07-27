import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";

function selectedSkill(skills, name) {
  return (skills || []).some((skill) => skill?.name === name);
}

export function applyNecromancerBuildAttributeRules(
  common,
  { build, selectedSkills = [], disabledTrait = null },
) {
  const attributes = common.attributes;
  const activeTraits = getActiveTraits(build.specializations || []).filter(
    (trait) => trait.name !== disabledTrait,
  );
  const hasTrait = (name) => activeTraits.some((trait) => trait.name === name);
  const traitStats = {};
  const traitDurations = {};

  if (hasTrait("Spiteful Fortitude")) {
    addAttribute(traitStats, "Vitality", attributes.Power.final * 0.1);
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
  const vitality = attributes.Vitality.final + Number(traitStats.Vitality || 0);
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
      (attributes["Condition Damage"].final +
        Number(traitStats["Condition Damage"] || 0)) *
        0.07,
    );
  }
  if (selectedSkill(selectedSkills, "Signet of Spite")) {
    addAttribute(traitStats, "Power", 180);
  }
  if (hasTrait("Barbed Precision")) {
    traitDurations["Bleeding Duration"] = 20;
  }

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}
