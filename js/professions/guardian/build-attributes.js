import {
  addAttribute,
  finalizeBuildAttributes,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";

function selectedSkill(skills, name) {
  return (skills || []).some(skill => skill?.name === name);
}

export function applyGuardianBuildAttributeRules(
  common,
  {
    build,
    selectedSkills = [],
    weaponSet = 1,
    disabledTrait = null,
  },
) {
  const attributes = common.attributes;
  const activeTraits = getActiveTraits(build.specializations || [])
    .filter(trait => trait.name !== disabledTrait);
  const hasTrait = name => activeTraits.some(trait => trait.name === name);
  const traitStats = {};
  const traitDurations = {};
  const weapons = weaponSet === 2
    ? build.alternateWeapons
    : build.weapons;
  const mainHand = weapons?.[0] || "";
  const offHand = weapons?.[1] || "";

  if (hasTrait("Right-Hand Strength")) {
    addAttribute(traitStats, "Precision", 80);
    if (mainHand && mainHand !== "Greatsword" && mainHand !== "Hammer"
      && mainHand !== "Longbow" && mainHand !== "Spear"
      && mainHand !== "Staff") {
      addAttribute(traitStats, "Power", 80);
    }
  }
  if (hasTrait("Zealous Blade")) {
    addAttribute(traitStats, "Power", 120);
    if (mainHand === "Greatsword") {
      addAttribute(traitStats, "Power", 120);
    }
  }
  if (hasTrait("Radiant Power")) {
    addAttribute(traitStats, "Ferocity", 150);
  }
  if (hasTrait("Kindled Zeal")) {
    addAttribute(
      traitStats,
      "Condition Damage",
      Math.round(attributes.Power.final * 0.1),
    );
  }
  if (hasTrait("Stalwart Defender") && offHand === "Shield") {
    addAttribute(traitStats, "Toughness", 240);
  }
  if (hasTrait("Honorable Staff")) {
    addAttribute(traitStats, "Concentration", 120);
  }
  if (hasTrait("Defender's Dogma")) {
    addAttribute(traitStats, "Vitality", 180);
  }
  if (hasTrait("Imbued Haste") && build.assumptions?.quickness !== false) {
    addAttribute(traitStats, "Condition Damage", 250);
    addAttribute(traitStats, "Healing Power", 250);
    addAttribute(traitStats, "Vitality", 250);
  }
  if (hasTrait("Searing Pact")) {
    addAttribute(traitStats, "Condition Damage", 120);
  }
  if (hasTrait("Power for Power")) addAttribute(traitStats, "Power", 120);
  if (hasTrait("Conceited Curate")) {
    addAttribute(traitStats, "Vitality", 180);
  }
  if (hasTrait("Light's Gift")) addAttribute(traitStats, "Vitality", 180);

  const signetMultiplier = hasTrait("Perfect Inscriptions") ? 1.2 : 1;
  if (selectedSkill(selectedSkills, "Bane Signet")) {
    addAttribute(traitStats, "Power", 180 * signetMultiplier);
  }
  if (selectedSkill(selectedSkills, "Signet of Wrath")) {
    addAttribute(
      traitStats,
      "Condition Damage",
      180 * signetMultiplier,
    );
  }

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}
