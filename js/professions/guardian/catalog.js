import {
  createCanonicalCatalog,
} from "../../platform/engine/catalog.js";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/guardian-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import { GUARDIAN_BUNDLE_SKILLS } from "./data/guardian-bundle-skills.js";
import {
  GUARDIAN_AUTOATTACK_CHAINS,
} from "./mechanics/autoattack-chains.js";
import { guardianSkillHandlers } from "./mechanics/handlers.js";
import {
  GUARDIAN_EXTRA_SKILLS,
  GUARDIAN_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";

export const GUARDIAN_NON_DPS_SKILL_NAMES = Object.freeze(new Set([
  "\"Advance!\"",
  "\"Save Yourselves!\"",
  "\"Hold the Line!\"",
  "Signet of Mercy",
  "Merciful Intervention",
  "Wall of Reflection",
  "Contemplation of Purity",
  "\"Stand Your Ground!\"",
  "Valorous Stance",
  "Stalwart Stance",
  "Mantra of Lore",
  "Hallowed Ground",
]));

const allSkills = Object.freeze([...SKILLS, ...GUARDIAN_BUNDLE_SKILLS]);
const generatedById = new Map(allSkills.map(skill => [skill.id, skill]));
const chainRootById = new Map();
for (const chain of GUARDIAN_AUTOATTACK_CHAINS) {
  for (const skillId of chain) chainRootById.set(skillId, chain[0]);
}
const flipParentById = new Map();
for (const skill of allSkills) {
  if (
    skill.flipSkillId != null
    && skill.flipSkillId !== skill.nextChainId
    && generatedById.has(skill.flipSkillId)
    && generatedById.get(skill.flipSkillId)?.name !== skill.name
    && !generatedById.get(skill.flipSkillId)?.categories
      ?.includes("Virtue")
  ) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}

const generated = allSkills.map(skill => {
  const flipParentId = flipParentById.get(skill.id);
  return {
    ...skill,
    cooldown:
      skill.ammo > 0
        ? skill.ammoRecharge || skill.recharge
        : skill.recharge,
    chainRoot: chainRootById.get(skill.id) ?? null,
    flipParentId: flipParentId ?? null,
    flipParent: flipParentId == null
      ? ""
      : generatedById.get(flipParentId)?.name || "",
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
