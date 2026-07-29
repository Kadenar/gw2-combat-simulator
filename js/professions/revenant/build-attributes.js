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
  if (hasTrait("Seething Malice")) {
    addAttribute(traitStats, "Condition Damage", 120);
  }
  if (hasTrait("Pact of Pain")) {
    traitDurations["Condition Duration"] = 15;
  }
  if (hasTrait("Yearning Empowerment")) {
    for (const condition of [
      "Bleeding",
      "Burning",
      "Confusion",
      "Poison",
      "Torment",
    ]) {
      traitDurations[`${condition} Duration`] = 10;
    }
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
