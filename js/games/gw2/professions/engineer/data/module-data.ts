import {
  createFlipParentMap,
  createProfessionModuleDataFactory,
  defineProfessionWeapons,
  normalizeGeneratedSkill
} from '#gw2/professions/shared/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/engineer/data/engineer-api-metadata.js';
import { ENGINEER_SUPPLEMENTAL_SKILLS } from '#gw2/professions/engineer/data/engineer-supplemental-skills.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { TRAITS } from '#gw2/professions/engineer/data/traits-data.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

const ENGINEER_SKILL_ICON_OVERRIDES = new Map<string, string>([
  ['Lesser Grenade Barrage', 'https://render.guildwars2.com/file/5B2AB667667749BC1BC7AEFD27362E3E0E0F2FE6/103294.png'],
  [
    'Defensive Protocol: Cleanse',
    'https://render.guildwars2.com/file/71A2EA9B60E691E61521C2B621E665146BF1D1DD/3680127.png'
  ],
  [
    'Defensive Protocol: Protect',
    'https://render.guildwars2.com/file/C043950F01DF7093BA14ACCCF67D1A16F245EAA8/3680132.png'
  ],
  [
    'Defensive Protocol: Thorns',
    'https://render.guildwars2.com/file/5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png'
  ],
  [
    'Offensive Protocol: Demolish',
    'https://render.guildwars2.com/file/337E150FB638D080A5A845A73D06B3E3ED7494C7/3680128.png'
  ],
  [
    'Offensive Protocol: Obliterate',
    'https://render.guildwars2.com/file/569A167830C12BFC730095C72F1D095A7323DC3D/3680130.png'
  ],
  [
    'Offensive Protocol: Pierce',
    'https://render.guildwars2.com/file/6C253CBFD36ABEB219013B62C4C73193C947ED60/3680131.png'
  ],
  [
    'Offensive Protocol: Shred',
    'https://render.guildwars2.com/file/09A6184ADE9313765B0620780A27B23F4DF31D1A/3680134.png'
  ]
]);

const PATCH_AUTHORING_EXCLUDED_SKILL_IDS = new Set<SkillId>([
  ID.CLEANSING_BURST,
  ID.DEPLOY_MINE,
  ID.CONFUSING_SPEECH,
  ID.VENT_RADIATION,
  ID.STATIC_DISCHARGE_TRAIT_SKILL,
  ID.MAGNETIC_BOMB_TRAIT_SKILL,
  ID.SUPERSPEED_TRAIT_SKILL,
  ID.FIRE_SHIELD_TRAIT_SKILL,
  ID.MAGNETIC_AURA_TRAIT_SKILL,
  ID.BUNKER_DOWN_TRAIT_SKILL,
  ID.DETONATE_SUPPLY_CRATE_TURRETS,
  ID.INVISIBLE_ANALYSIS,
  ID.CLEANSING_PULSE,
  ID.BANDAGE_TRAIT_SKILL,
  ID.OVERCHARGE_SUPPLY_CRATE,
  ID.DEPLOY_MINE_ID_30893,
  ID.CONTROLLED_ANALYSIS,
  ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL
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

const allDeclared: readonly Skill[] = [...generatedSource, ...ENGINEER_SUPPLEMENTAL_SKILLS];

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

const generated: readonly Skill[] = generatedSource.map((skill) => ({
  ...normalizeGeneratedSkill(skill, flipParentById.get(skill.id) ?? null),
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id)
    ? {
        patchAuthoringExcluded: true
      }
    : {})
}));

const supplemental: readonly Skill[] = ENGINEER_SUPPLEMENTAL_SKILLS.map((skill) => ({
  ...skill,
  icon: ENGINEER_SKILL_ICON_OVERRIDES.get(skill.name) || skill.icon,
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
export const createEngineerModuleData = createProfessionModuleDataFactory({
  generatedSkills: generated,
  sharedExtraSkills: supplemental,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  specializationOnlySkills: SPECIALIZATION_ONLY_SKILLS,
  core: WEAPON_DATA
});
