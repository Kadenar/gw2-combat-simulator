import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import {
  defineCatalogOwnership,
} from "../../platform/engine/catalog-ownership.js";
import { SKILLS, SPECIALIZATIONS } from "./data/guardian-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import { GUARDIAN_BUNDLE_SKILLS } from "./data/guardian-bundle-skills.js";
import { GUARDIAN_SKILL_IDS as ID } from "./data/ids.js";
import { guardianSkillHandlers } from "./handlers.js";
import {
  GUARDIAN_EXTRA_SKILLS,
  GUARDIAN_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import type {
  SkillId,
} from "../../platform/engine/types.js";
import type { GuardianSkill } from "./types.js";

export const GUARDIAN_NON_DPS_SKILL_NAMES = Object.freeze(
  new Set([
    '"Advance!"',
    '"Save Yourselves!"',
    '"Hold the Line!"',
    "Signet of Mercy",
    "Merciful Intervention",
    "Wall of Reflection",
    "Contemplation of Purity",
    '"Stand Your Ground!"',
    "Valorous Stance",
    "Stalwart Stance",
    "Mantra of Lore",
    "Hallowed Ground",
    "Bow of Truth",
  ]),
);

const allSkills: readonly GuardianSkill[] = Object.freeze([
  ...SKILLS,
  ...GUARDIAN_BUNDLE_SKILLS,
]);
const generatedById = new Map(allSkills.map((skill) => [skill.id, skill]));
const flipParentById = new Map<SkillId, SkillId>();
for (const skill of allSkills) {
  if (
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    generatedById.has(skill.flipSkillId) &&
    generatedById.get(skill.flipSkillId)?.name !== skill.name &&
    !generatedById.get(skill.flipSkillId)?.categories?.includes("Virtue")
  ) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}

const generated = allSkills.map((skill) => {
  const flipParentId = flipParentById.get(skill.id);
  return {
    ...skill,
    cooldown:
      Number(skill.ammo || 0) > 0
        ? skill.ammoRecharge || skill.recharge
        : skill.recharge,
    flipParentId: flipParentId ?? null,
    flipParent:
      flipParentId == null ? "" : generatedById.get(flipParentId)?.name || "",
    simulatorExcluded: GUARDIAN_NON_DPS_SKILL_NAMES.has(skill.name),
    implemented: false,
    effects: [],
  };
});

export const guardianCatalog = createCanonicalCatalog({
  generated,
  mechanics: GUARDIAN_SKILL_MECHANICS,
  extraSkills: GUARDIAN_EXTRA_SKILLS,
  skillHandlers: guardianSkillHandlers,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  weapons: [
    "Axe",
    "Focus",
    "Greatsword",
    "Hammer",
    "Longbow",
    "Mace",
    "Pistol",
    "Scepter",
    "Shield",
    "Spear",
    "Staff",
    "Sword",
    "Torch",
  ],
  weaponHands: {
    Axe: "mh",
    Focus: "oh",
    Greatsword: "2h",
    Hammer: "2h",
    Longbow: "2h",
    Mace: "mh",
    Pistol: "mh+oh",
    Scepter: "mh",
    Shield: "oh",
    Spear: "2h",
    Staff: "2h",
    Sword: "mh+oh",
    Torch: "oh",
  },
});

export const GUARDIAN_SKILLS = guardianCatalog.skills;

export const GUARDIAN_ELITE_SPECIALIZATIONS = Object.freeze([
  "Dragonhunter",
  "Firebrand",
  "Willbender",
  "Luminary",
]);

export const guardianCatalogOwnership = defineCatalogOwnership({
  catalog: guardianCatalog,
  modules: ["Core", ...GUARDIAN_ELITE_SPECIALIZATIONS],
  skillOverrides: {
    [ID.SPEAR_OF_JUSTICE]: "Dragonhunter",
    [ID.HUNTERS_VERDICT]: "Dragonhunter",
    [ID.STOW_TOME]: "Firebrand",
    [ID.TOME_OF_RESOLVE]: "Firebrand",
    [ID.TOME_OF_COURAGE]: "Firebrand",
    [ID.TOME_OF_COURAGE_ID_42371]: "Firebrand",
    [ID.TOME_OF_JUSTICE]: "Firebrand",
    [ID.TOME_OF_JUSTICE_ID_68647]: "Firebrand",
    [ID.TOME_OF_RESOLVE_ID_68648]: "Firebrand",
    [ID.TOME_OF_COURAGE_ID_68650]: "Firebrand",
    [ID.WILLBENDER_FLAMES]: "Willbender",
    [ID.WILLBENDER_FLAMES_ID_62618]: "Willbender",
    [ID.CRASHING_COURAGE]: "Willbender",
    [ID.CRASHING_COURAGE_ID_62648]: "Willbender",
    [ID.FLOWING_RESOLVE]: "Willbender",
    [ID.RUSHING_JUSTICE]: "Willbender",
    [ID.EXIT_RADIANT_FORGE]: "Luminary",
    [ID.ENTER_RADIANT_FORGE]: "Luminary",
    [ID.RADIANT_COURAGE]: "Luminary",
    [ID.RADIANT_COURAGE_ID_78770]: "Luminary",
    [ID.RADIANT_RESOLVE]: "Luminary",
    [ID.RADIANT_RESOLVE_ID_78604]: "Luminary",
    [ID.RADIANT_JUSTICE]: "Luminary",
  },
  handlerOwners: {
    "guardian.stow-tome": "Firebrand",
    "guardian.tome-page": "Firebrand",
    "guardian.radiant-forge": "Luminary",
    "guardian.radiant-weapon": "Luminary",
    "guardian.glaring-burst": "Luminary",
  },
  core: { ownsWeapons: true },
});

export function guardianSkillRuntimeOwner(skill: GuardianSkill): string {
  return guardianCatalogOwnership.skillOwners.get(skill.id) || "Core";
}

export const guardianModuleCatalog = guardianCatalogOwnership.fragment;
