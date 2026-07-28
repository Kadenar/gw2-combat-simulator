import { createCanonicalCatalog } from "../../platform/engine/catalog.js";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "./data/thief-api-metadata.js";
import { TRAITS } from "./data/traits-data.js";
import {
  THIEF_SUPPLEMENTAL_SKILLS,
} from "./data/thief-supplemental-skills.js";
import {
  THIEF_EXTRA_SKILLS,
  THIEF_SKILL_MECHANICS,
} from "./mechanics/skill-mechanics.js";
import {
  THIEF_WIKI_RESEARCH_BY_ID,
  thiefSupplementalSkill,
} from "./mechanics/wiki-mechanics.js";
import { thiefAutoattackChains } from "./mechanics/autoattack-chains.js";

const researchMetadata = id => {
  const record = THIEF_WIKI_RESEARCH_BY_ID.get(id);
  return record ? thiefSupplementalSkill(record, id) : {};
};
const DUAL_FOLLOWUP_BY_PARENT = Object.freeze({
  13010: 59526, // Shadow Strike -> Repeater
  13016: 13007, // Flanking Strike -> Larcenous Strike
  63267: 63128, // Measured Shot -> Endless Night
});
const DUAL_FOLLOWUP_IDS = new Set(
  Object.values(DUAL_FOLLOWUP_BY_PARENT),
);
const terrestrialVariantNames = new Set(
  SKILLS
    .filter(skill => (skill.flags || []).includes("NoUnderwater"))
    .map(skill => skill.name),
);
const generatedSource = SKILLS
  .filter(skill =>
    !terrestrialVariantNames.has(skill.name)
    || (skill.flags || []).includes("NoUnderwater"))
  .map(skill => ({
  ...skill,
  ...researchMetadata(skill.id),
  id: skill.id,
  name: skill.name,
  description: skill.description,
  icon: skill.icon,
  type: researchMetadata(skill.id).artifactKind
    ? researchMetadata(skill.id).type
    : skill.type,
  slot: researchMetadata(skill.id).artifactKind
    ? researchMetadata(skill.id).slot
    : skill.slot,
  weapon: skill.weapon || researchMetadata(skill.id).weapon,
  specialization:
    skill.specialization || researchMetadata(skill.id).specialization,
  categories:
    skill.categories?.length
      ? skill.categories
      : researchMetadata(skill.id).categories,
  flags: skill.flags,
  nextChainId: skill.nextChainId,
  flipSkillId:
    DUAL_FOLLOWUP_BY_PARENT[skill.id]
    ?? (skill.type === "Weapon" ? null : skill.flipSkillId),
  }));
const allDeclared = [...generatedSource, ...THIEF_SUPPLEMENTAL_SKILLS];
const declaredIds = new Set(allDeclared.map(skill => skill.id));
const terrestrialMechanics = Object.fromEntries(
  Object.entries(THIEF_SKILL_MECHANICS)
    .filter(([id]) => declaredIds.has(Number(id))),
);
const byId = new Map(allDeclared.map(skill => [skill.id, skill]));
const chains = thiefAutoattackChains(allDeclared);
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
  dualWieldOpener: Object.hasOwn(DUAL_FOLLOWUP_BY_PARENT, skill.id),
  dualWieldFollowup: DUAL_FOLLOWUP_IDS.has(skill.id),
});
const generated = generatedSource.map(skill => ({
  ...normalize(skill),
  implemented: false,
  effects: [],
}));
const supplemental = THIEF_SUPPLEMENTAL_SKILLS.map(normalize);

export const thiefCatalog = createCanonicalCatalog({
  generated,
  mechanics: terrestrialMechanics,
  extraSkills: [...supplemental, ...THIEF_EXTRA_SKILLS],
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  weapons: [
    "Axe",
    "Dagger",
    "Pistol",
    "Rifle",
    "Scepter",
    "Shortbow",
    "Spear",
    "Staff",
    "Sword",
  ],
  weaponHands: {
    Axe: "mh",
    Dagger: "mh+oh",
    Pistol: "mh+oh",
    Rifle: "2h",
    Scepter: "mh",
    Shortbow: "2h",
    Spear: "2h",
    Staff: "2h",
    Sword: "mh",
  },
});
export const THIEF_SKILLS = thiefCatalog.skills;
export const THIEF_AUTOATTACK_CHAINS = chains;

export function thiefWeaponSkillMatchesSet(skill, pair, context = {}) {
  if (
    skill.requiredMainHand != null
    || skill.requiredOffHand != null
    || skill.requiresEmptyOffhand
  ) {
    const [mainHand = "", offHand = ""] = pair;
    return (
      (skill.requiredMainHand == null || skill.requiredMainHand === mainHand)
      && (
        skill.requiredOffHand == null
        || (
          skill.requiredOffHand === false
            ? !offHand
            : skill.requiredOffHand === offHand
        )
      )
    );
  }
  const wielding = context.weaponData?.[pair[0]]?.wielding
    || context.catalog?.weaponHands?.get(pair[0]);
  if (wielding === "2h") return skill.weapon === pair[0];
  const slot = Number(String(skill.slot || "").match(/(\d+)$/)?.[1] || 0);
  return slot <= 3 ? skill.weapon === pair[0] : skill.weapon === pair[1];
}
