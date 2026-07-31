import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import { SKILLS, SPECIALIZATIONS } from "./data/guardian-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import { GUARDIAN_BUNDLE_SKILLS } from "./data/guardian-bundle-skills.js";
import { guardianSkillHandlers } from "./handlers.js";
import {
  GUARDIAN_EXTRA_SKILLS,
  GUARDIAN_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import type {
  ProfessionModuleCatalogFragment,
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

const eliteSpecializations = new Set(GUARDIAN_ELITE_SPECIALIZATIONS);
const ELITE_PROFESSION_SKILL_NAMES: Readonly<
  Record<string, ReadonlySet<string>>
> = Object.freeze({
  Dragonhunter: new Set([
    "Spear of Justice",
    "Hunter's Verdict",
    "Wings of Resolve",
    "Shield of Courage",
  ]),
  Firebrand: new Set([
    "Stow Tome",
    "Tome of Justice",
    "Tome of Resolve",
    "Tome of Courage",
  ]),
  Willbender: new Set([
    "Willbender Flames",
    "Rushing Justice",
    "Flowing Resolve",
    "Crashing Courage",
  ]),
  Luminary: new Set([
    "Enter Radiant Forge",
    "Exit Radiant Forge",
    "Radiant Justice",
    "Radiant Resolve",
    "Radiant Courage",
  ]),
});

export function guardianSkillRuntimeOwner(skill: GuardianSkill): string {
  if (skill.type === "Weapon") return "Core";
  if (eliteSpecializations.has(String(skill.specialization || ""))) {
    return String(skill.specialization);
  }
  for (const [owner, names] of Object.entries(ELITE_PROFESSION_SKILL_NAMES)) {
    if (names.has(skill.name)) return owner;
  }
  return "Core";
}

const fragmentCache = new Map<string, ProfessionModuleCatalogFragment>();

/**
 * Returns the inert Core or elite catalog slice used by family composition.
 * Elite weapon skills remain Core-owned because they are profession-wide.
 */
export function guardianModuleCatalog(
  moduleId: string,
): Readonly<ProfessionModuleCatalogFragment> {
  const cached = fragmentCache.get(moduleId);
  if (cached) return cached;
  if (moduleId !== "Core" && !eliteSpecializations.has(moduleId)) {
    throw new Error(`Unknown Guardian catalog module ${moduleId}.`);
  }
  const core = moduleId === "Core";
  const fragment: ProfessionModuleCatalogFragment = Object.freeze({
    skills: Object.freeze(
      guardianCatalog.skills.filter(
        (skill) => guardianSkillRuntimeOwner(skill) === moduleId,
      ),
    ),
    traits: Object.freeze(
      guardianCatalog.traits.filter((trait) =>
        core
          ? !eliteSpecializations.has(String(trait.specialization || ""))
          : trait.specialization === moduleId,
      ),
    ),
    specializations: Object.freeze(
      guardianCatalog.specializations.filter((specialization) =>
        core ? !specialization.elite : specialization.name === moduleId,
      ),
    ),
    ...(core
      ? {
          weapons: Object.freeze([...guardianCatalog.weapons]),
          weaponHands: new Map(guardianCatalog.weaponHands),
        }
      : {}),
  });
  fragmentCache.set(moduleId, fragment);
  return fragment;
}
