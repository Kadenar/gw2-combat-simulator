import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";
import type { Skill } from "../../platform/engine/types.js";
import type {
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes,
} from "../../platform/gw2/types.js";
import type { ThiefBuild } from "./types.js";

function wields(build: ThiefBuild, weapon: string, weaponSet: number): boolean {
  const weapons =
    weaponSet === 2 ? build.alternateWeapons : build.weapons;
  return (weapons || []).includes(weapon);
}
function selectedSkill(skills: readonly Skill[], name: string): boolean {
  return (skills || []).some(skill => skill?.name === name);
}

export function applyThiefBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  {
    build,
    selectedSkills = [],
    weaponSet = 1,
    disabledTrait = null,
  }: Gw2BuildAttributeRuleContext,
): Gw2FinalizedAttributeResult {
  const thiefBuild = build as ThiefBuild;
  const { conversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(thiefBuild.specializations || [])
    .filter(trait => trait.name !== disabledTrait);
  const hasTrait = (name: string): boolean =>
    activeTraits.some(trait => trait.name === name);
  const traitStats: Gw2NumericAttributes = {};
  const traitDurations: Gw2NumericAttributes = {};

  if (hasTrait("Dagger Training")) {
    addAttribute(
      traitStats,
      "Power",
      wields(thiefBuild, "Dagger", weaponSet) ? 160 : 80,
    );
  }
  if (hasTrait("Deadly Ambition")) {
    addAttribute(traitStats, "Condition Damage", 180);
  }
  if (hasTrait("Revealed Training")) addAttribute(traitStats, "Power", 80);
  if (hasTrait("Practiced Tolerance")) {
    addAttribute(
      traitStats,
      "Ferocity",
      Math.round((conversionPool.Precision || 0) * 0.1),
    );
  }
  if (hasTrait("No Quarter") && thiefBuild.assumptions?.fury) {
    addAttribute(traitStats, "Ferocity", 250);
  }
  if (hasTrait("Preparedness")) addAttribute(traitStats, "Expertise", 150);
  if (hasTrait("Staff Master")) {
    addAttribute(
      traitStats,
      "Power",
      wields(thiefBuild, "Staff", weaponSet) ? 240 : 120,
    );
  }
  if (hasTrait("Marauder's Resilience")) {
    addAttribute(
      traitStats,
      "Vitality",
      Math.round((conversionPool.Power || 0) * 0.07),
    );
  }
  if (hasTrait("Swindler's Equilibrium")) {
    addAttribute(
      traitStats,
      "Power",
      wields(thiefBuild, "Sword", weaponSet) ? 240 : 120,
    );
  }
  if (hasTrait("Silent Scope")) addAttribute(traitStats, "Precision", 120);
  if (hasTrait("Premeditation")) {
    addAttribute(traitStats, "Concentration", 180);
  }
  if (hasTrait("Second Opinion")) {
    addAttribute(
      traitStats,
      "Condition Damage",
      wields(thiefBuild, "Scepter", weaponSet) ? 180 : 90,
    );
    addAttribute(
      traitStats,
      "Healing Power",
      Math.round((conversionPool["Condition Damage"] || 0) * 0.07),
    );
  }
  if (hasTrait("Strength of Shadows")) {
    addAttribute(
      traitStats,
      "Expertise",
      Math.round((conversionPool.Vitality || 0) * 0.13),
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
