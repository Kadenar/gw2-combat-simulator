import type { SkillId } from '#gw2/platform/skills/types.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/engineer/data/engineer-api-metadata.js';
import { ENGINEER_SUPPLEMENTAL_SKILLS } from '#gw2/professions/engineer/data/engineer-supplemental-skills.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { TRAITS } from '#gw2/professions/engineer/data/traits-data.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';
import {
  createFlipParentMap,
  createProfessionModuleDataFactory,
  defineProfessionWeapons,
  normalizeGeneratedSkill
} from '#gw2/professions/shared/catalog-data.js';

const PATCH_AUTHORING_EXCLUDED_SKILL_IDS = new Set<SkillId>([
  ID.CLEANSING_BURST,
  ID.MAGNETIC_AURA_TRAIT_SKILL,
  ID.BUNKER_DOWN_TRAIT_SKILL,
  ID.DETONATE_SUPPLY_CRATE_TURRETS,
  ID.CLEANSING_PULSE,
  ID.BANDAGE_TRAIT_SKILL,
  ID.OVERCHARGE_SUPPLY_CRATE
]);

/** Catalog, equipment matching, and cast availability share the non-Holosmith sword identities. */
export const NON_HOLOSMITH_SWORD_SKILL_IDS: ReadonlySet<SkillId> = new Set([
  ID.SUN_EDGE_NON_HOLOSMITH,
  ID.SUN_RIPPER_NON_HOLOSMITH,
  ID.GLEAM_SABER_NON_HOLOSMITH,
  ID.RADIANT_ARC_NON_HOLOSMITH,
  ID.REFRACTION_CUTTER_NON_HOLOSMITH
]);

const generatedSource = SKILLS.map((skill) => ({
  ...skill,
  // Weaponmaster sword variants are profession-wide despite the API's stale Holosmith label.
  ...(NON_HOLOSMITH_SWORD_SKILL_IDS.has(skill.id) ? { specialization: '' } : {})
}));

const allDeclared: readonly EngineerSkill[] = [...generatedSource, ...ENGINEER_SUPPLEMENTAL_SKILLS];

const preferredFlipParentById = new Map<SkillId, SkillId>([
  [ID.DETONATE_HEALING_TURRET, ID.HEALING_TURRET],
  // The GW2 API doesn't link Cleansing Burst back to Healing Turret's flip chain.
  [ID.CLEANSING_BURST, ID.HEALING_TURRET],
  [ID.DETONATE, ID.THROW_MINE],
  [ID.STOW_FLAMETHROWER, ID.FLAMETHROWER],
  [ID.ELECTRIC_ARTILLERY, ID.LIGHTNING_ROD]
]);

const flipParentById = createFlipParentMap(allDeclared, {
  overrides: preferredFlipParentById
});

const generated: readonly EngineerSkill[] = generatedSource.map((skill) => ({
  ...normalizeGeneratedSkill(skill, flipParentById.get(skill.id) ?? null),
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id)
    ? {
        patchAuthoringExcluded: true
      }
    : {})
}));

// Supplemental records own their verified CDN icons; catalog assembly only adds availability metadata.
const supplemental: readonly EngineerSkill[] = ENGINEER_SUPPLEMENTAL_SKILLS.map((skill) => ({
  ...skill,
  flipParentId: flipParentById.get(skill.id) ?? null,
  slotSelectable: false,
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id)
    ? {
        patchAuthoringExcluded: true
      }
    : {})
}));

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Holosmith: [
    ID.DEACTIVATE_PHOTON_FORGE,
    ID.DEACTIVATE_PHOTON_FORGE_HOT,
    ID.ENGAGE_PHOTON_FORGE,
    ID.RADIANT_ARC,
    ID.SUN_RIPPER,
    ID.SUN_EDGE,
    ID.GLEAM_SABER,
    ID.REFRACTION_CUTTER,
    ID.REFRACTION_CUTTER_BLADE,
    ID.FLASH_CUTTER_STORM,
    ID.BRIGHT_SLASH_STORM,
    ID.HOLOGRAPHIC_SHOCKWAVE,
    ID.HOLO_LEAP,
    ID.LIGHT_STRIKE_STORM,
    ID.CORONA_BURST,
    ID.LIGHT_STRIKE,
    ID.BRIGHT_SLASH,
    ID.PHOTON_BLITZ,
    ID.FLASH_CUTTER
  ],
  Scrapper: [ID.FUNCTION_GYRO],
  Amalgam: [ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX, ID.LOCKED, ID.LOCKED_ID_77107, ID.LOCKED_ID_77388]
});

const WEAPON_DATA = defineProfessionWeapons({
  Hammer: '2h',
  Mace: 'mh',
  Pistol: 'mh+oh',
  Rifle: '2h',
  Shield: 'oh',
  Shortbow: '2h',
  Spear: '2h',
  Sword: 'mh'
});

/** Builds Engineer module catalogs directly from their ID-linked skill declarations. */
// Preserve Engineer fields through module registration and selected catalog lookups.
export const createEngineerModuleData = createProfessionModuleDataFactory<EngineerSkill>({
  generatedSkills: generated,
  sharedExtraSkills: supplemental,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  specializationOnlySkills: SPECIALIZATION_ONLY_SKILLS,
  core: WEAPON_DATA
});
