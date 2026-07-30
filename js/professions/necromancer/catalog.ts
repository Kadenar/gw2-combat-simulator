import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import { SKILLS, SPECIALIZATIONS } from "./data/necromancer-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import { NECROMANCER_SUPPLEMENTAL_SKILLS } from "./data/necromancer-supplemental-skills.js";
import {
  NECROMANCER_EXTRA_SKILLS,
  NECROMANCER_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import { NECROMANCER_SKILL_IDS } from "./data/ids.js";
import { necromancerSkillHandlers } from "./mechanics/specific/handlers.js";
import type {
  Skill,
  SkillId,
} from "../../platform/engine/types.js";
import type {
  NecromancerSkill,
} from "./types.js";

export const NECROMANCER_NON_DPS_SKILL_NAMES = Object.freeze(
  new Set([
    "Well of Blood",
    "Consume Conditions",
    "Spectral Armor",
    "Spectral Walk",
    "Spectral Recall",
    "Well of Power",
    "Weapon of Warding",
    "Weapon of Remedy",
    "Xinrae's Weapon",
  ]),
);

const CANONICAL_ALIAS_ID_BY_NAME: Readonly<Record<string, SkillId>> =
  Object.freeze({
  "Manifest Sand Shade": NECROMANCER_SKILL_IDS.MANIFEST_SAND_SHADE,
});
const STATIC_REPLACEMENT_PAIRS = new Set<string>([
  `${NECROMANCER_SKILL_IDS.LIFE_BLAST}:${NECROMANCER_SKILL_IDS.DHUUMFIRE_BLAST}`,
  `${NECROMANCER_SKILL_IDS.FEAST_OF_CORRUPTION}:${NECROMANCER_SKILL_IDS.DEVOURING_DARKNESS}`,
  `${NECROMANCER_SKILL_IDS.DESERT_SHROUD}:${NECROMANCER_SKILL_IDS.SANDSTORM_SHROUD}`,
]);
const UNSUPPORTED_SKILL_IDS = new Set<SkillId>([
  NECROMANCER_SKILL_IDS.SUMMON_FLESH_WURM,
  NECROMANCER_SKILL_IDS.NECROTIC_TRAVERSAL,
  NECROMANCER_SKILL_IDS.CORRUPT_BOON,
  NECROMANCER_SKILL_IDS.EPIDEMIC,
  NECROMANCER_SKILL_IDS.SPECTRAL_RING,
]);

const allSkills: readonly Skill[] = Object.freeze(
  [...SKILLS, ...NECROMANCER_SUPPLEMENTAL_SKILLS]
    .filter(skill => !UNSUPPORTED_SKILL_IDS.has(skill.id))
    .sort((left, right) => {
      const leftCanonical =
        CANONICAL_ALIAS_ID_BY_NAME[left.name] === left.id ? 0 : 1;
      const rightCanonical =
        CANONICAL_ALIAS_ID_BY_NAME[right.name] === right.id ? 0 : 1;
      return leftCanonical - rightCanonical || Number(left.id) - Number(right.id);
    }),
);
const generatedById = new Map<SkillId, Skill>(
  allSkills.map((skill) => [skill.id, skill]),
);
const flipParentById = new Map<SkillId, SkillId>();
for (const skill of allSkills) {
  const flipSkillId = skill.flipSkillId;
  if (flipSkillId == null) continue;
  const child = generatedById.get(flipSkillId);
  if (
    child &&
    flipSkillId !== skill.nextChainId &&
    child.name !== skill.name &&
    !STATIC_REPLACEMENT_PAIRS.has(`${skill.id}:${flipSkillId}`)
  ) {
    flipParentById.set(flipSkillId, skill.id);
  }
}

const generated = allSkills.map((skill) => {
  const canonicalAliasId = CANONICAL_ALIAS_ID_BY_NAME[skill.name];
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
    simulatorAliasOfId:
      canonicalAliasId && canonicalAliasId !== skill.id
        ? canonicalAliasId
        : null,
    simulatorExcluded:
      NECROMANCER_NON_DPS_SKILL_NAMES.has(skill.name) ||
      Boolean(canonicalAliasId && canonicalAliasId !== skill.id),
    implemented: false,
    effects: [],
  };
});

export const necromancerCatalog =
  createCanonicalCatalog({
  generated,
  mechanics: NECROMANCER_SKILL_MECHANICS,
  extraSkills: NECROMANCER_EXTRA_SKILLS,
  autoattackChains: {
    // The API omits or does not classify these nonstandard chain links.
    additional: [
      [
        NECROMANCER_SKILL_IDS.ENERVATION_BLADE,
        NECROMANCER_SKILL_IDS.ENERVATION_ECHO,
      ],
      [
        NECROMANCER_SKILL_IDS.LIFE_REND,
        NECROMANCER_SKILL_IDS.LIFE_SLASH,
        NECROMANCER_SKILL_IDS.LIFE_REAP,
      ],
    ],
  },
  skillHandlers: necromancerSkillHandlers,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  weapons: [
    "Axe",
    "Dagger",
    "Focus",
    "Greatsword",
    "Pistol",
    "Scepter",
    "Spear",
    "Staff",
    "Sword",
    "Torch",
    "Warhorn",
  ],
  weaponHands: {
    Axe: "mh",
    Dagger: "mh+oh",
    Focus: "oh",
    Greatsword: "2h",
    Pistol: "mh",
    Scepter: "mh",
    Spear: "2h",
    Staff: "2h",
    Sword: "mh+oh",
    Torch: "oh",
    Warhorn: "oh",
  },
  });

export const NECROMANCER_SKILLS = necromancerCatalog.skills;
