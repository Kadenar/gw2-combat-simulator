import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";

function wields(build, weapon) {
  return [build.weapons, build.alternateWeapons]
    .flatMap(pair => pair || [])
    .includes(weapon);
}
function selectedSkill(skills, name) {
  return (skills || []).some(skill => skill?.name === name);
}

export function applyThiefBuildAttributeRules(
  common,
  { build, selectedSkills = [], disabledTrait = null },
) {
  const attributes = common.attributes;
  const activeTraits = getActiveTraits(build.specializations || [])
    .filter(trait => trait.name !== disabledTrait);
  const hasTrait = name => activeTraits.some(trait => trait.name === name);
  const traitStats = {};
  const traitDurations = {};

  if (hasTrait("Dagger Training")) {
    addAttribute(traitStats, "Power", wields(build, "Dagger") ? 240 : 120);
  }
  if (hasTrait("Deadly Ambition")) {
    addAttribute(traitStats, "Condition Damage", 120);
  }
  if (hasTrait("Revealed Training")) addAttribute(traitStats, "Power", 120);
  if (hasTrait("Practiced Tolerance")) {
    addAttribute(
      traitStats,
      "Ferocity",
      Math.round(Number(attributes.Precision?.final || 0) * 0.07),
    );
  }
  if (hasTrait("No Quarter") && build.assumptions?.fury) {
    addAttribute(traitStats, "Ferocity", 250);
  }
  if (hasTrait("Preparedness")) addAttribute(traitStats, "Expertise", 150);
  if (hasTrait("Staff Master")) {
    addAttribute(traitStats, "Power", wields(build, "Staff") ? 240 : 120);
  }
  if (hasTrait("Marauder's Resilience")) {
    addAttribute(
      traitStats,
      "Vitality",
      Math.round(Number(attributes.Power?.final || 0) * 0.07),
    );
  }
  if (hasTrait("Swindler's Equilibrium")) {
    addAttribute(traitStats, "Power", wields(build, "Sword") ? 240 : 120);
  }
  if (hasTrait("Silent Scope")) addAttribute(traitStats, "Precision", 120);
  if (hasTrait("Premeditation")) {
    addAttribute(traitStats, "Concentration", 180);
  }
  if (hasTrait("Second Opinion")) {
    addAttribute(
      traitStats,
      "Condition Damage",
      wields(build, "Scepter") ? 240 : 120,
    );
    addAttribute(
      traitStats,
      "Healing Power",
      Math.round(Number(attributes["Condition Damage"]?.final || 0) * 0.07),
    );
  }
  if (hasTrait("Strength of Shadows")) {
    addAttribute(
      traitStats,
      "Expertise",
      Math.round(Number(attributes.Vitality?.final || 0) * 0.07),
    );
  }
  if (selectedSkill(selectedSkills, "Assassin's Signet")) {
    addAttribute(traitStats, "Power", 180);
  }

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}
