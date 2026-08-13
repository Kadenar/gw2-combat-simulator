import {
  finalizeBuildAttributes,
  resolveAttributeEffects,
} from "../../platform/gw2/attributes.js";
import { getActiveTraits } from "./data/traits-data.js";
import type { Skill } from "../../platform/engine/types.js";
import type {
  Gw2CommonAttributeResult,
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes,
} from "../../platform/gw2/types.js";
import type { GuardianBuild } from "./types.js";

function selectedSkill(skills: readonly Skill[], name: string): boolean {
  return (skills || []).some((skill) => skill?.name === name);
}

export function applyGuardianBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  {
    build,
    selectedSkills = [],
    weaponSet = 1,
    disabledTrait = null,
  }: Gw2BuildAttributeRuleContext,
): Gw2FinalizedAttributeResult {
  const guardianBuild = build as GuardianBuild;
  const { conversionPool: commonConversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(
    guardianBuild.specializations || [],
  ).filter((trait) => trait.name !== disabledTrait);
  const hasTrait = (name: string): boolean =>
    activeTraits.some((trait) => trait.name === name);
  const traitDurations: Gw2NumericAttributes = {};
  const weapons =
    weaponSet === 2 ? guardianBuild.alternateWeapons : guardianBuild.weapons;
  const mainHand = weapons?.[0] || "";
  const offHand = weapons?.[1] || "";
  const oneHandedMainHand =
    mainHand !== "" &&
    !["Greatsword", "Hammer", "Longbow", "Spear", "Staff"].includes(mainHand);
  const signetMultiplier = hasTrait("Perfect Inscriptions") ? 1.2 : 1;
  const quickness = guardianBuild.assumptions?.quickness !== false;
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: "flat",
      source: "Right-Hand Strength",
      to: "Precision",
      amount: 80,
      feedsConversions: false,
      enabled: hasTrait("Right-Hand Strength"),
    },
    {
      kind: "flat",
      source: "Right-Hand Strength",
      to: "Power",
      amount: 80,
      feedsConversions: false,
      enabled: hasTrait("Right-Hand Strength") && oneHandedMainHand,
    },
    {
      kind: "flat",
      source: "Zealous Blade",
      to: "Power",
      amount: mainHand === "Greatsword" ? 240 : 120,
      feedsConversions: false,
      enabled: hasTrait("Zealous Blade"),
    },
    {
      kind: "flat",
      source: "Radiant Power",
      to: "Ferocity",
      amount: 150,
      feedsConversions: false,
      enabled: hasTrait("Radiant Power"),
    },
    {
      kind: "flat",
      source: "Stalwart Defender",
      to: "Toughness",
      amount: 240,
      feedsConversions: false,
      enabled: hasTrait("Stalwart Defender") && offHand === "Shield",
    },
    {
      kind: "flat",
      source: "Honorable Staff",
      to: "Concentration",
      amount: 120,
      feedsConversions: false,
      enabled: hasTrait("Honorable Staff"),
    },
    {
      kind: "flat",
      source: "Defender's Dogma",
      to: "Vitality",
      amount: 180,
      feedsConversions: true,
      enabled: hasTrait("Defender's Dogma"),
    },
    {
      kind: "flat",
      source: "Force of Will",
      to: "Vitality",
      amount: 300,
      feedsConversions: true,
      enabled: hasTrait("Force of Will"),
    },
    {
      kind: "flat",
      source: "Imbued Haste",
      to: "Condition Damage",
      amount: 250,
      feedsConversions: true,
      enabled: hasTrait("Imbued Haste") && quickness,
    },
    {
      kind: "flat",
      source: "Imbued Haste",
      to: "Healing Power",
      amount: 250,
      feedsConversions: true,
      enabled: hasTrait("Imbued Haste") && quickness,
    },
    {
      kind: "flat",
      source: "Imbued Haste",
      to: "Vitality",
      amount: 250,
      feedsConversions: true,
      enabled: hasTrait("Imbued Haste") && quickness,
    },
    {
      kind: "flat",
      source: "Searing Pact",
      to: "Condition Damage",
      amount: 120,
      feedsConversions: true,
      enabled: hasTrait("Searing Pact"),
    },
    {
      kind: "flat",
      source: "Power for Power",
      to: "Power",
      amount: 120,
      feedsConversions: true,
      enabled: hasTrait("Power for Power"),
    },
    {
      kind: "flat",
      source: "Conceited Curate",
      to: "Vitality",
      amount: 180,
      feedsConversions: true,
      enabled: hasTrait("Conceited Curate"),
    },
    {
      kind: "flat",
      source: "Light's Gift",
      to: "Vitality",
      amount: 180,
      feedsConversions: true,
      enabled: hasTrait("Light's Gift"),
    },
    {
      kind: "conversion",
      source: "Kindled Zeal",
      from: "Power",
      to: "Condition Damage",
      multiplier: 0.1,
      rounding: "round",
      input: "eligible",
      enabled: hasTrait("Kindled Zeal"),
    },
    {
      kind: "flat",
      source: "Bane Signet",
      to: "Power",
      amount: 180 * signetMultiplier,
      feedsConversions: false,
      enabled: selectedSkill(selectedSkills, "Bane Signet"),
    },
    {
      kind: "flat",
      source: "Signet of Wrath",
      to: "Condition Damage",
      amount: 180 * signetMultiplier,
      feedsConversions: false,
      enabled: selectedSkill(selectedSkills, "Signet of Wrath"),
    },
    {
      kind: "conversion",
      source: "Power of the Virtuous",
      from: "Vitality",
      to: "Condition Damage",
      multiplier: 0.07,
      rounding: "round",
      input: "eligible",
      enabled: hasTrait("Power of the Virtuous"),
    },
  ];
  const traitStats = resolveAttributeEffects(
    commonConversionPool,
    attributeEffects,
  );
  if (hasTrait("Radiant Fire")) {
    traitDurations["Burning Duration"] = 20;
  }

  return finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations,
  });
}
