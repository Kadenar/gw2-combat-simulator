import {
  createFlipParentMap,
  createProfessionModuleDataFactory,
  defineProfessionWeapons,
  normalizeGeneratedSkill
} from '#gw2/professions/shared/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/ranger/data/ranger-api-metadata.js';
import { RANGER_PET_SKILLS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_SUPPLEMENTAL_SKILLS } from '#gw2/professions/ranger/data/ranger-supplemental-skills.js';
import { TRAITS } from '#gw2/professions/ranger/data/traits-data.js';
import { isRangerHammerVariant } from '#gw2/professions/ranger/data/hammer-variants.js';
import type { CatalogEntity, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

const petSkillIds = new Set<SkillId>(RANGER_PET_SKILLS.map((skill) => skill.id));
const apiSkills = SKILLS as readonly RangerSkill[];
const petSkills = RANGER_PET_SKILLS as readonly RangerSkill[];
const allSkills = [...apiSkills, ...petSkills, ...RANGER_SUPPLEMENTAL_SKILLS];

const simulatorExcludedSkillIds = new Set<SkillId>([ID.EXPLODING_SPORE, ID.WUTHERING_WIND]);

const PATCH_AUTHORING_EXCLUDED_SKILL_IDS = new Set<SkillId>([
  ID.WORLDLY_IMPACT_ID_42809,
  ID.ETERNAL_BOND,
  ID.UNDEAD_PLAGUE,
  ID.PHASE_POUNCE
]);

const flipParentById = createFlipParentMap(allSkills);

const DRUID_PROFESSION_SKILLS = Object.freeze([ID.CELESTIAL_AVATAR, ID.RELEASE_CELESTIAL_AVATAR]);

const UNTAMED_PROFESSION_SKILLS = Object.freeze([
  ID.ENVELOPING_HAZE,
  ID.UNLEASH_RANGER,
  ID.VENOMOUS_OUTBURST,
  ID.RENDING_VINES,
  ID.UNLEASH_PET,
  ID.RELENTLESS_WHIRL,
  ID.DEFT_STRIKE
]);

const UNTAMED_PET_SKILLS: readonly SkillId[] = Object.freeze([
  ID.ENVELOPING_HAZE,
  ID.VENOMOUS_OUTBURST,
  ID.RENDING_VINES
]);

const UNTAMED_AMBUSH_SKILLS: readonly SkillId[] = Object.freeze([ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]);

const GALESHOT_PROFESSION_SKILLS = Object.freeze([ID.SUMMON_CYCLONE_BOW, ID.DISMISS_CYCLONE_BOW]);

const reservedProfessionIds = new Set<SkillId>([
  ...DRUID_PROFESSION_SKILLS,
  ...UNTAMED_PROFESSION_SKILLS,
  ...GALESHOT_PROFESSION_SKILLS
]);

const SOULBEAST_PROFESSION_SKILLS = Object.freeze(
  apiSkills
    .filter((skill) => skill.type === 'Profession' && !reservedProfessionIds.has(skill.id))
    .map((skill) => skill.id)
);

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Druid: DRUID_PROFESSION_SKILLS,
  Soulbeast: SOULBEAST_PROFESSION_SKILLS,
  Untamed: UNTAMED_PROFESSION_SKILLS,
  Galeshot: GALESHOT_PROFESSION_SKILLS
});

// Normalize generated Ranger skill metadata and handler defaults before the
// catalog freezes specialization module data.
function normalize(skill: RangerSkill): RangerSkill {
  const petSkill = petSkillIds.has(skill.id);

  const beastmodeSkill = SOULBEAST_PROFESSION_SKILLS.includes(skill.id);

  const unleashedPetSkill = UNTAMED_PET_SKILLS.includes(skill.id);

  const unleashedAmbushSkill = UNTAMED_AMBUSH_SKILLS.includes(skill.id);

  return {
    ...normalizeGeneratedSkill(skill, flipParentById.get(skill.id) ?? null),
    paletteFlip: isRangerHammerVariant(skill.id) ? false : skill.paletteFlip,
    petSkill,
    independentCast: petSkill || unleashedPetSkill,
    independentCastCanOverlap: petSkill,
    usableWhileRecharging: petSkill || skill.usableWhileRecharging,
    rechargeBuffAudience: petSkill ? 'summon' : skill.rechargeBuffAudience,
    beastmodeSkill,
    unleashedPetSkill,
    unleashedAmbushSkill
  };
}

const generated = allSkills.map((skill) => ({
  ...normalize(skill),
  simulatorExcluded: simulatorExcludedSkillIds.has(skill.id),
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id)
    ? {
        patchAuthoringExcluded: true
      }
    : {})
}));

const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh+oh',
  Dagger: 'mh+oh',
  Greatsword: '2h',
  Hammer: '2h',
  Longbow: '2h',
  Mace: 'mh+oh',
  Shortbow: '2h',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh',
  Torch: 'oh',
  Warhorn: 'oh'
});

/** Binds the shared catalog while leaving skill admission to each module's mechanics. */
export const createRangerModuleData = createProfessionModuleDataFactory<RangerSkill>({
  generatedSkills: generated,
  traits: TRAITS as readonly CatalogEntity[],
  specializations: SPECIALIZATIONS,
  specializationOnlySkills: SPECIALIZATION_ONLY_SKILLS,
  core: WEAPON_DATA
});
