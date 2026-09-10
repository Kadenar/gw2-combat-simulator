import { MANTRAS } from '#gw2/professions/guardian/specializations/firebrand/mantras.js';
import { createNativeModuleData } from '#gw2/platform/profession-definition/catalog.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import { createFlipParentMap, defineProfessionWeapons } from '#gw2/professions/lib/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/professions/lib/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/guardian/data/guardian-api-metadata.js';
import { GUARDIAN_BUNDLE_SKILLS } from '#gw2/professions/guardian/data/guardian-bundle-skills.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { TRAITS } from '#gw2/professions/guardian/data/traits-data.js';
import type { CatalogEntity, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

const allSkills: readonly GuardianSkill[] = Object.freeze([...SKILLS, ...GUARDIAN_BUNDLE_SKILLS]);

const generatedById = new Map(allSkills.map((skill) => [skill.id, skill]));

const willbenderFlameIds = new Set<SkillId>([
  ID.WILLBENDER_FLAMES,
  ID.WILLBENDER_FLAMES_ID_62618,
  ID.WILLBENDER_FLAMES_COURAGE
]);

const firebrandFinalFlipByNormalId = new Map<SkillId, SkillId>(
  MANTRAS.map(({ normalId, finalId }) => [normalId, finalId])
);

const flipParentById = createFlipParentMap(allSkills, {
  include(parent, child) {
    return (
      parent.flipSkillId !== ID.GLACIAL_BLOW &&
      !willbenderFlameIds.has(parent.flipSkillId!) &&
      child.name !== parent.name &&
      !child.categories?.includes('Virtue')
    );
  }
});

flipParentById.set(ID.SHIELD_OF_ABSORPTION_ID_9224, ID.SHIELD_OF_ABSORPTION);

for (const [normalId, finalId] of firebrandFinalFlipByNormalId) {
  flipParentById.set(finalId, normalId);
}

const generated: readonly Skill[] = allSkills.map((skill) => {
  const flipParentId = flipParentById.get(skill.id);

  const flipParent = flipParentId == null ? undefined : generatedById.get(flipParentId);

  return {
    ...skill,
    flipSkillId: firebrandFinalFlipByNormalId.get(skill.id) ?? skill.flipSkillId,
    cooldown: gw2BaseRecharge(skill),
    flipParentId: flipParentId ?? null,
    flipParent: flipParent?.name || '',
    ...(skill.id === ID.MIGHTY_BLOW || skill.id === ID.GLACIAL_BLOW
      ? {
          paletteFlip: false
        }
      : {}),
    // Valorous Stance remains simulated, but has no supported patch-authoring surface.
    ...(skill.id === ID.VALOROUS_STANCE
      ? {
          patchAuthoringExcluded: true
        }
      : {}),
    effects: []
  };
});

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Dragonhunter: [ID.SPEAR_OF_JUSTICE, ID.HUNTERS_VERDICT],
  Firebrand: [ID.STOW_TOME, ID.TOME_OF_RESOLVE, ID.TOME_OF_COURAGE, ID.TOME_OF_COURAGE_ID_42371, ID.TOME_OF_JUSTICE],
  Willbender: [
    ID.WILLBENDER_FLAMES,
    ID.WILLBENDER_FLAMES_ID_62618,
    ID.CRASHING_COURAGE,
    ID.FLOWING_RESOLVE,
    ID.RUSHING_JUSTICE
  ],
  Luminary: [ID.EXIT_RADIANT_FORGE, ID.ENTER_RADIANT_FORGE, ID.RADIANT_COURAGE, ID.RADIANT_RESOLVE, ID.RADIANT_JUSTICE]
});

const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh',
  Focus: 'oh',
  Greatsword: '2h',
  Hammer: '2h',
  Longbow: '2h',
  Mace: 'mh',
  Pistol: 'mh+oh',
  Scepter: 'mh',
  Shield: 'oh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh'
});

/** Composes module skills and profiles; the profession definition owns autoattack-chain overrides. */
export function createGuardianModuleData(
  id: string,
  { skillMechanics, extraSkills = [], balanceProfiles = [] }: ProfessionModuleDataOptions
) {
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    skillMechanics,
    extraSkills,
    balanceProfiles,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    ...(id === 'Core' ? WEAPON_DATA : {})
  });
}
