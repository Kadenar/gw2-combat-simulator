import {
  createCanonicalCatalog,
} from "../../platform/engine/catalog.js";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/necromancer-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  NECROMANCER_SUPPLEMENTAL_SKILLS,
} from "./data/necromancer-supplemental-skills.js";
import {
  NECROMANCER_EXTRA_SKILLS,
  NECROMANCER_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  NECROMANCER_AUTOATTACK_CHAINS,
} from "./mechanics/autoattack-chains.js";
import { NECROMANCER_SKILL_IDS } from "./data/ids.js";
import { necromancerSkillHandlers } from "./mechanics/handlers.js";

export const NECROMANCER_NON_DPS_SKILL_NAMES = Object.freeze(new Set([
  "Well of Blood",
  "Consume Conditions",
  "Plague Signet",
  "Spectral Armor",
  "Spectral Walk",
  "Spectral Recall",
  "Well of Power",
  "Resilient Weapon",
  "Weapon of Warding",
  "Weapon of Remedy",
  "Xinrae's Weapon",
]));

const CANONICAL_ALIAS_ID_BY_NAME = Object.freeze({
  "Manifest Sand Shade": NECROMANCER_SKILL_IDS.MANIFEST_SAND_SHADE,
});
const STATIC_REPLACEMENT_PAIRS = new Set([
  `${NECROMANCER_SKILL_IDS.LIFE_BLAST}:${NECROMANCER_SKILL_IDS.DHUUMFIRE_BLAST}`,
  `${NECROMANCER_SKILL_IDS.FEAST_OF_CORRUPTION}:${NECROMANCER_SKILL_IDS.DEVOURING_DARKNESS}`,
  `${NECROMANCER_SKILL_IDS.DESERT_SHROUD}:${NECROMANCER_SKILL_IDS.SANDSTORM_SHROUD}`,
]);
const EXPLICIT_FLIP_PARENT_BY_ID = new Map([
  [NECROMANCER_SKILL_IDS.NECROTIC_TRAVERSAL, 10543],
]);

const allSkills = Object.freeze([
  ...SKILLS,
  ...NECROMANCER_SUPPLEMENTAL_SKILLS,
].sort((left, right) => {
  const leftCanonical =
    CANONICAL_ALIAS_ID_BY_NAME[left.name] === left.id ? 0 : 1;
  const rightCanonical =
    CANONICAL_ALIAS_ID_BY_NAME[right.name] === right.id ? 0 : 1;
  return leftCanonical - rightCanonical || left.id - right.id;
}));
const generatedById = new Map(allSkills.map(skill => [skill.id, skill]));
const chainRootById = new Map();
for (const chain of NECROMANCER_AUTOATTACK_CHAINS) {
  for (const skillId of chain) chainRootById.set(skillId, chain[0]);
}
const flipParentById = new Map();
for (const [childId, parentId] of EXPLICIT_FLIP_PARENT_BY_ID) {
  flipParentById.set(childId, parentId);
}
for (const skill of allSkills) {
  const child = generatedById.get(skill.flipSkillId);
  if (
    child
    && skill.flipSkillId !== skill.nextChainId
    && child.name !== skill.name
    && !STATIC_REPLACEMENT_PAIRS.has(`${skill.id}:${skill.flipSkillId}`)
  ) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}

const generated = allSkills.map(skill => {
  const canonicalAliasId = CANONICAL_ALIAS_ID_BY_NAME[skill.name];
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
    simulatorAliasOfId:
      canonicalAliasId && canonicalAliasId !== skill.id
        ? canonicalAliasId
        : null,
    simulatorExcluded:
      NECROMANCER_NON_DPS_SKILL_NAMES.has(skill.name)
      || Boolean(canonicalAliasId && canonicalAliasId !== skill.id),
    implemented: false,
    effects: [],
  };
});

export const necromancerCatalog = createCanonicalCatalog({
  generated,
  mechanics: NECROMANCER_SKILL_MECHANICS,
  extraSkills: NECROMANCER_EXTRA_SKILLS,
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
