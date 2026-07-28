import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/engineer-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  ENGINEER_SUPPLEMENTAL_SKILLS,
} from "./data/engineer-supplemental-skills.js";
import {
  ENGINEER_EXTRA_SKILLS,
  ENGINEER_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  ENGINEER_WIKI_RESEARCH_BY_ID,
  engineerSupplementalSkill,
} from "./mechanics/wiki-mechanics.js";
import {
  engineerAutoattackChains,
} from "./mechanics/autoattack-chains.js";

const generatedIds = new Set(SKILLS.map(skill => skill.id));
const researchMetadata = id => {
  const research = ENGINEER_WIKI_RESEARCH_BY_ID.get(id);
  return research ? engineerSupplementalSkill(research, id) : {};
};
const generatedSource = SKILLS.map(skill => ({
  ...skill,
  ...researchMetadata(skill.id),
  // Generated identity remains authoritative for these fields.
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
const allDeclared = [...generatedSource, ...ENGINEER_SUPPLEMENTAL_SKILLS];
const byId = new Map(allDeclared.map(skill => [skill.id, skill]));
const chains = engineerAutoattackChains(allDeclared);
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
  ) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}
const generated = generatedSource.map(skill => ({
  ...skill,
  cooldown:
    skill.ammo > 0 ? skill.ammoRecharge || skill.recharge : skill.recharge,
  chainRoot: chainRootById.get(skill.id) ?? null,
  chainStep: chainStepById.get(skill.id) ?? null,
  flipParentId: flipParentById.get(skill.id) ?? null,
  implemented: false,
  effects: [],
}));
const supplemental = ENGINEER_SUPPLEMENTAL_SKILLS.map(skill => ({
  ...skill,
  chainRoot: chainRootById.get(skill.id) ?? null,
  chainStep: chainStepById.get(skill.id) ?? null,
  flipParentId: flipParentById.get(skill.id) ?? null,
}));

export const engineerCatalog = createCanonicalCatalog({
  generated,
  mechanics: ENGINEER_SKILL_MECHANICS,
  extraSkills: [...supplemental, ...ENGINEER_EXTRA_SKILLS],
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  weapons: [
    "Hammer",
    "Mace",
    "Pistol",
    "Rifle",
    "Shield",
    "Shortbow",
    "Spear",
    "Sword",
  ],
  weaponHands: {
    Hammer: "2h",
    Mace: "mh",
    Pistol: "mh+oh",
    Rifle: "2h",
    Shield: "oh",
    Shortbow: "2h",
    Spear: "2h",
    Sword: "mh",
  },
});

export const ENGINEER_SKILLS = engineerCatalog.skills;
export const ENGINEER_AUTOATTACK_CHAINS = chains;
export const ENGINEER_GENERATED_SKILL_IDS = Object.freeze([...generatedIds]);
