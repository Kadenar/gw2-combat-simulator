import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";
import type {
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes,
} from "../../platform/gw2/types.js";
import type {
  EngineerBuild,
} from "./types.js";

export function applyEngineerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, disabledTrait = null }: Gw2BuildAttributeRuleContext,
): Gw2FinalizedAttributeResult {
  const { conversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(
    (build as EngineerBuild).specializations || [],
  )
    .filter(trait => trait.name !== disabledTrait);
  const hasTrait = (name: string): boolean =>
    activeTraits.some(trait => trait.name === name);
  const traitStats: Gw2NumericAttributes = {};
  const traitDurations: Gw2NumericAttributes = {};

  if (hasTrait("Blast Shield")) {
    addAttribute(traitStats, "Vitality", (conversionPool.Power || 0) * 0.1);
  }
  if (hasTrait("Chemical Rounds")) {
    addAttribute(traitStats, "Condition Damage", 120);
  }
  if (hasTrait("Thermal Vision")) {
    addAttribute(traitStats, "Expertise", 150);
  }
  if (
    hasTrait("Energy Amplifier")
    && (build as EngineerBuild).assumptions?.regeneration !== false
  ) {
    addAttribute(traitStats, "Power", 250);
    addAttribute(traitStats, "Healing Power", 250);
  }
  if (
    hasTrait("No Scope")
    && (build as EngineerBuild).assumptions?.fury !== false
  ) {
    addAttribute(traitStats, "Ferocity", 150);
  }
  if (hasTrait("Kinetic Accelerators")) {
    addAttribute(
      traitStats,
      "Concentration",
      Math.round((conversionPool.Power || 0) * 0.13),
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
