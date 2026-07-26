import {
  addAttribute,
  CONDITION_DURATION_ATTRIBUTES,
  derivedAttribute,
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
  const attributes = structuredClone(common.attributes);
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

  for (const [name, amount] of Object.entries(traitStats)) {
    if (!attributes[name]) continue;
    attributes[name].traits += amount;
    attributes[name].final += amount;
  }

  const {
    runeDurations,
    foodDurations,
    sigilDurations,
    sigilCriticalChance,
  } = common.commonContext;
  const precision = attributes.Precision.final;
  const ferocity = attributes.Ferocity.final;
  const concentration = attributes.Concentration.final;
  const expertise = attributes.Expertise.final;
  attributes["Critical Chance"] = derivedAttribute(
    (precision - 895) / 21 + sigilCriticalChance,
    0,
    sigilCriticalChance,
  );
  attributes["Critical Damage"] = derivedAttribute(150 + ferocity / 15);
  attributes["Boon Duration"] = derivedAttribute(
    concentration / 15
      + (runeDurations["Boon Duration"] || 0)
      + (foodDurations["Boon Duration"] || 0)
      + (sigilDurations["Boon Duration"] || 0),
    0,
    sigilDurations["Boon Duration"] || 0,
    runeDurations["Boon Duration"] || 0,
    foodDurations["Boon Duration"] || 0,
  );
  attributes["Condition Duration"] = derivedAttribute(
    expertise / 15
      + (runeDurations["Condition Duration"] || 0)
      + (foodDurations["Condition Duration"] || 0)
      + (sigilDurations["Condition Duration"] || 0),
    0,
    sigilDurations["Condition Duration"] || 0,
    runeDurations["Condition Duration"] || 0,
    foodDurations["Condition Duration"] || 0,
  );
  for (const key of CONDITION_DURATION_ATTRIBUTES) {
    const value =
      (runeDurations[key] || 0)
      + (traitDurations[key] || 0)
      + (foodDurations[key] || 0)
      + (sigilDurations[key] || 0);
    if (!value) continue;
    attributes[key] = derivedAttribute(
      value,
      traitDurations[key] || 0,
      sigilDurations[key] || 0,
      runeDurations[key] || 0,
      foodDurations[key] || 0,
    );
  }
  const { commonContext, ...result } = common;
  return { ...result, attributes, activeTraits };
}
