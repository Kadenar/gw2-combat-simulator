import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";

export function applyEngineerBuildAttributeRules(
  common,
  { build, disabledTrait = null },
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
  if (hasTrait("Thermal Vision")) {
    addAttribute(traitStats, "Expertise", 150);
  }
  if (
    hasTrait("Energy Amplifier")
    && build.assumptions?.regeneration !== false
  ) {
    addAttribute(traitStats, "Power", 250);
    addAttribute(traitStats, "Healing Power", 250);
  }
  if (hasTrait("No Scope") && build.assumptions?.fury !== false) {
    addAttribute(traitStats, "Ferocity", 150);
  }
  if (hasTrait("Kinetic Accelerators")) {
    addAttribute(
      traitStats,
      "Concentration",
      Math.round(attributes.Power.final * 0.13),
    );
  }
  if (hasTrait("Compounding Chemicals")) {
    addAttribute(traitStats, "Concentration", 240);
  }
  if (hasTrait("Hybrid Vigor")) {
    addAttribute(traitStats, "Vitality", 240);
  }

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}
