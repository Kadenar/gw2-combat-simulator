import { createNativeModuleData } from '../../platform/gw2/native-profession.js';
import { createFlipParentMap, createSpecializationSkillOwners, defineProfessionWeapons } from '../lib/catalog-data.js';
import type { ProfessionModuleDataOptions } from '../lib/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from './data/revenant-api-metadata.js';
import { REVENANT_SKILL_IDS as ID } from './data/ids.js';
import { REVENANT_SUPPLEMENTAL_SKILLS } from './data/revenant-supplemental-skills.js';
import { TRAITS } from './data/traits-data.js';
import type { CatalogEntity, Skill, SkillId } from '../../platform/engine/types.js';

const PATCH_AUTHORING_EXCLUDED_SKILL_IDS = new Set<SkillId>([
  ID.DOME_OF_THE_MISTS,
  ID.IGNITING_BRAND,
  ID.SPEAR_OF_ANGUISH,
  ID.FRIGID_DISCHARGE,
  ID.DEVOUR_BRAND,
  ID.VENOMOUS_SPHERE,
  ID.RAPID_ASSAULT,
  ID.RIFT_CONTAINMENT,
  ID.HEALING_ORB,
  ID.RITE_OF_THE_GREAT_DWARF_TRAIT_SKILL,
  ID.VENGEFUL_SNOWBALLS,
  ID.ESSENCE_SAP_DOPPELGANGER,
  ID.CALL_OF_THE_DWARF,
  ID.CALL_OF_THE_CENTAUR,
  ID.UNCHAINED_DESOLATION,
  ID.LEGENDARY_PRISONER_STANCE,
  ID.RIFT_OF_PAIN,
  ID.PORTAL_FIRE,
  ID.TORRENTIAL_MISTS,
  ID.OTHERWORLDLY_ATTRACTION_ALLY,
  ID.OTHERWORLDLY_ATTRACTION_ENEMY,
  ID.REPLENISHING_DESPAIR_TRAIT_SKILL
]);

const generatedSource = SKILLS.filter((skill) => skill.name !== "Duelist's Preparation").map((skill) => ({
  ...skill
}));

const allDeclared: readonly Skill[] = [...generatedSource, ...REVENANT_SUPPLEMENTAL_SKILLS];

const flipParentById = createFlipParentMap(allDeclared);

const normalize = (skill: Skill): Skill => ({
  ...skill,
  simulatorExcluded: false,
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id)
    ? {
        patchAuthoringExcluded: true
      }
    : {}),
  ...(skill.recharge == null && skill.ammoRecharge == null
    ? {}
    : {
        cooldown: Number(skill.ammo) > 0 ? skill.ammoRecharge || skill.recharge : skill.recharge
      }),
  flipParentId: flipParentById.get(skill.id) ?? skill.flipParentId ?? null
});

const generated = generatedSource.map((skill) => ({
  ...normalize(skill),
  implemented: false,
  effects: []
}));

const supplemental = REVENANT_SUPPLEMENTAL_SKILLS.map(normalize);

export const REVENANT_DECLARED_SKILLS: readonly Skill[] = Object.freeze([...generated, ...supplemental]);

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Herald: [
    ID.FACET_OF_NATURE,
    ID.TRUE_NATURE,
    ID.TRUE_NATURE_ID_51675,
    ID.TRUE_NATURE_ID_51696,
    ID.TRUE_NATURE_ID_51713,
    ID.TRUE_NATURE_ID_51714
  ],
  Renegade: [ID.HEROIC_COMMAND, ID.CITADEL_BOMBARDMENT, ID.ORDERS_FROM_ABOVE],
  Vindicator: [ID.ALLIANCE_TACTICS, ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058],
  Conduit: [
    ID.COSMIC_WISDOM,
    ID.RELEASE_POTENTIAL_MONK,
    ID.RELEASE_POTENTIAL_MESMER,
    ID.RELEASE_POTENTIAL_DERVISH,
    ID.RELEASE_POTENTIAL_ASSASSIN,
    ID.RELEASE_POTENTIAL_WARRIOR
  ]
});

const SPECIALIZATION_ONLY_SKILL_OWNERS = createSpecializationSkillOwners(SPECIALIZATION_ONLY_SKILLS);

const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'oh',
  Greatsword: '2h',
  Hammer: '2h',
  Mace: 'mh',
  Scepter: 'mh',
  Shield: 'oh',
  Shortbow: '2h',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh'
});

export function createRevenantModuleData(
  id: string,
  { skillMechanics, extraSkills = [], balanceProfiles = [], handlers }: ProfessionModuleDataOptions<never>
) {
  return createNativeModuleData<never>({
    id,
    generatedSkills: generated,
    sharedExtraSkills: supplemental,
    skillMechanics,
    extraSkills,
    balanceProfiles,
    handlers,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === 'Core' ? WEAPON_DATA : {})
  });
}
