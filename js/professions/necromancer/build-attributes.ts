import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import {
  getActiveTraits,
} from "./data/traits-data.js";
import type {
  Skill,
} from "../../platform/engine/types.js";
import type {
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes,
} from "../../platform/gw2/types.js";
import type {
  NecromancerSpecializationSelection,
} from "./data/traits-data.js";

function selectedSkill(skills: readonly Skill[], name: string): boolean {
  return (skills || []).some((skill) => skill?.name === name);
}

export function applyNecromancerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  {
    build,
    selectedSkills = [],
    disabledTrait = null,
  }: Gw2BuildAttributeRuleContext,
): Gw2FinalizedAttributeResult {
  const attributes = common.attributes;
  const activeTraits = getActiveTraits(
    (build.specializations || []) as NecromancerSpecializationSelection[],
  ).filter(
    (trait) => trait.name !== disabledTrait,
  );
  const hasTrait = (name: string) =>
    activeTraits.some((trait) => trait.name === name);
  const traitStats: Gw2NumericAttributes = {};
  const traitDurations: Gw2NumericAttributes = {};

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
    addAttribute(traitStats, "Expertise", vitality * 0.1);
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
