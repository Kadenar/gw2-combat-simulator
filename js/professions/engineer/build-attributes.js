import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";

function selectedSkill(skills, name) {
  return (skills || []).some(skill => skill?.name === name);
}

export function applyEngineerBuildAttributeRules(
  common,
  { build, selectedSkills = [], disabledTrait = null },
) {
  const attributes = common.attributes;
  const activeTraits = getActiveTraits(build.specializations || [])
    .filter(trait => trait.name !== disabledTrait);
  const hasTrait = name => activeTraits.some(trait => trait.name === name);
  const traitStats = {};
  const traitDurations = {};

  if (hasTrait("Blast Shield")) {
    addAttribute(traitStats, "Vitality", attributes.Power.final * 0.1);
  }
  if (hasTrait("Chemical Rounds")) {
    addAttribute(traitStats, "Condition Damage", 120);
  }
  if (hasTrait("High Caliber")) {
    addAttribute(traitStats, "Precision", 180);
  }
  if (hasTrait("Mass Momentum")) {
    addAttribute(traitStats, "Power", attributes.Toughness.final * 0.1);
  }
  if (hasTrait("Applied Force")) {
    addAttribute(traitStats, "Power", attributes.Concentration.final * 0.1);
  }
  if (hasTrait("Thermal Vision")) {
    traitDurations["Burning Duration"] = 20;
  }
  if (selectedSkill(selectedSkills, "Force Signet")) {
    addAttribute(traitStats, "Power", 180);
  }
  if (selectedSkill(selectedSkills, "Superconducting Signet")) {
    addAttribute(traitStats, "Condition Damage", 180);
  }

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}

