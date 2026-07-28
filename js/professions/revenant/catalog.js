import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/revenant-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  REVENANT_SUPPLEMENTAL_SKILLS,
} from "./data/revenant-supplemental-skills.js";
import {
  REVENANT_EXTRA_SKILLS,
  REVENANT_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  REVENANT_WIKI_RESEARCH_BY_ID,
  revenantSupplementalSkill,
} from "./mechanics/wiki-mechanics.js";
import {
  revenantAutoattackChains,
} from "./mechanics/autoattack-chains.js";

const researchMetadata = id => {
  const research = REVENANT_WIKI_RESEARCH_BY_ID.get(id);
  return research ? revenantSupplementalSkill(research, id) : {};
};
const generatedSource = SKILLS.map(skill => ({
  ...skill,
  ...researchMetadata(skill.id),
  id: skill.id,
  name: skill.name,
  description: skill.description,
  icon: skill.icon,
  type: skill.type,
  slot: skill.slot,
  weapon: skill.weapon,
  specialization: skill.specialization,
  categories: skill.categories,
  flags: skill.flags,
}));
const allDeclared = [...generatedSource, ...REVENANT_SUPPLEMENTAL_SKILLS];
const byId = new Map(allDeclared.map(skill => [skill.id, skill]));
const chains = revenantAutoattackChains(allDeclared);
const chainRootById = new Map();
const chainStepById = new Map();
for (const chain of chains) {
  chain.forEach((id, index) => {
    chainRootById.set(id, chain[0]);
    chainStepById.set(id, index + 1);
  });
}
const flipParentById = new Map();
for (const skill of allDeclared) {
  if (
    skill.flipSkillId != null
    && skill.flipSkillId !== skill.nextChainId
    && byId.has(skill.flipSkillId)
  ) flipParentById.set(skill.flipSkillId, skill.id);
}
const normalize = skill => ({
  ...skill,
  cooldown:
    skill.ammo > 0 ? skill.ammoRecharge || skill.recharge : skill.recharge,
  chainRoot: chainRootById.get(skill.id) ?? null,
  chainStep: chainStepById.get(skill.id) ?? null,
  flipParentId: flipParentById.get(skill.id) ?? null,
});
const generated = generatedSource.map(skill => ({
  ...normalize(skill),
  implemented: false,
  effects: [],
}));
const supplemental = REVENANT_SUPPLEMENTAL_SKILLS.map(normalize);

export const revenantCatalog = createCanonicalCatalog({
  generated,
  mechanics: REVENANT_SKILL_MECHANICS,
  extraSkills: [...supplemental, ...REVENANT_EXTRA_SKILLS],
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  weapons: [
    "Axe",
    "Greatsword",
    "Hammer",
    "Mace",
    "Scepter",
    "Shield",
    "Shortbow",
    "Spear",
    "Staff",
    "Sword",
  ],
  weaponHands: {
    Axe: "oh",
    Greatsword: "2h",
    Hammer: "2h",
    Mace: "mh",
    Scepter: "mh",
    Shield: "oh",
    Shortbow: "2h",
    Spear: "2h",
    Staff: "2h",
    Sword: "mh+oh",
  },
});

export const REVENANT_SKILLS = revenantCatalog.skills;
export const REVENANT_AUTOATTACK_CHAINS = chains;

