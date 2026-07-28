import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";

export function applyRevenantBuildAttributeRules(
  common,
  { build, disabledTrait = null },
) {
  const attributes = common.attributes;
  const activeTraits = getActiveTraits(build.specializations || [])
    .filter(trait => trait.name !== disabledTrait);
  const hasTrait = name => activeTraits.some(trait => trait.name === name);
  const traitStats = {};
  const traitDurations = {};
  if (hasTrait("Notoriety")) {
    addAttribute(
      traitStats,
      "Power",
      Math.max(0, Number(build.assumptions?.might || 0)) * 10,
    );
  }
  if (hasTrait("Pact of Pain")) {
    addAttribute(traitStats, "Condition Damage", 120);
  }
  if (hasTrait("Righteous Rebel")) {
    addAttribute(traitStats, "Concentration", 120);
  }
  if (hasTrait("Abyssal Chill")) {
    traitDurations["Torment Duration"] = 20;
  }
  if (hasTrait("Swift Termination")) {
    addAttribute(traitStats, "Ferocity", 180);
  }
  if (hasTrait("Replenishing Despair")) {
    addAttribute(traitStats, "Vitality", 120);
  }
  if (hasTrait("Hardening Persistence")) {
    addAttribute(traitStats, "Toughness", 120);
  }
  if (hasTrait("Elevated Compassion")) {
    addAttribute(traitStats, "Healing Power", attributes.Concentration.final * 0.13);
  }
  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}

