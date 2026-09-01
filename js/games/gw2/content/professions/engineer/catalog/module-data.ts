import { createNativeModuleData } from '#gw2/integrations/patches/authoring/catalog.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import {
  createFlipParentMap,
  createSpecializationSkillOwners,
  defineProfessionWeapons
} from '#gw2/content/professions/lib/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/content/professions/lib/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/content/professions/engineer/data/engineer-api-metadata.js';
import { ENGINEER_SUPPLEMENTAL_SKILLS } from '#gw2/content/professions/engineer/data/engineer-supplemental-skills.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import { TRAITS } from '#gw2/content/professions/engineer/data/traits-data.js';
import type { CatalogEntity, Skill, SkillFragment, SkillId } from '#gw2/platform/engine/types.js';
import type { NativeAutoattackChains } from '#gw2/integrations/patches/authoring/module-types.js';

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
  ID.JUMP_SHOT_ID_5817,
  ID.CLEANSING_BURST,
  ID.DEPLOY_MINE,
  ID.WITHERING_PLAGUE,
  ID.PLAGUE_OF_DARKNESS,
  ID.PLAGUE_OF_PESTILENCE,
  ID.CONFUSING_SPEECH,
  ID.PAIN_TRANSFERENCE,
  ID.VENT_RADIATION,
  ID.INVIGORATING_ROAR,
  ID.BOOBY_TRAP_CHARR_SKILL,
  ID.HIDDEN_PISTOLS,
  ID.THROW_VINE,
  ID.VINE_SHIELD,
  ID.ALLY_WARD,
  ID.STATIC_DISCHARGE_TRAIT_SKILL,
  ID.PLAGUE,
  ID.MAGNETIC_BOMB_TRAIT_SKILL,
  ID.SUPERSPEED_TRAIT_SKILL,
  ID.FIRE_SHIELD_TRAIT_SKILL,
  ID.MAGNETIC_AURA_TRAIT_SKILL,
  ID.GLUE_TRAIL,
  ID.BUNKER_DOWN_TRAIT_SKILL,
  ID.OVERFUELED_FLAME_JET,
  ID.DETONATE_SUPPLY_CRATE_TURRETS,
  ID.INVISIBLE_ANALYSIS,
  ID.CLEANSING_PULSE,
  ID.DROP_GUNK,
  ID.BANDAGE_TRAIT_SKILL,
  ID.OVERCHARGE_SUPPLY_CRATE,
  ID.LONG_FUSED_POWDER_PACK,
  ID.DEPLOY_MINE_ID_30893,
  ID.THROW_JUNK_DOPPELGANGER,
  ID.CONTROLLED_ANALYSIS,
  ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL
]);

const generatedIds = new Set<SkillId>(SKILLS.map((skill) => skill.id));

const CORE_SWORD_SKILL_IDS = new Set<SkillId>([
  ID.SUN_EDGE_ID_70514,
  ID.SUN_RIPPER_ID_69906,
  ID.GLEAM_SABER_ID_70771,
  ID.RADIANT_ARC_ID_69565,
  ID.REFRACTION_CUTTER_ID_71121
]);

const generatedSource = SKILLS.map((skill) => ({
  ...skill,
  // Weaponmaster sword variants are profession-wide despite the API's stale Holosmith label.
  ...(CORE_SWORD_SKILL_IDS.has(skill.id) ? { specialization: '' } : {})
}));

const allDeclared: readonly Skill[] = [...generatedSource, ...ENGINEER_SUPPLEMENTAL_SKILLS];

const byId = new Map<SkillId, Skill>(allDeclared.map((skill) => [skill.id, skill]));

const preferredFlipParentById = new Map<SkillId, SkillId>([
  [ID.DETONATE_HEALING_TURRET, ID.HEALING_TURRET],
  [ID.DETONATE, ID.THROW_MINE],
  [ID.STOW_FLAMETHROWER, ID.FLAMETHROWER],
  [ID.ELECTRIC_ARTILLERY, ID.LIGHTNING_ROD]
]);

const flipParentById = createFlipParentMap(allDeclared, {
  overrides: preferredFlipParentById
});

const generated: readonly Skill[] = generatedSource.map((skill) => ({
  ...skill,
  cooldown: gw2BaseRecharge(skill),
  flipParentId: flipParentById.get(skill.id) ?? null,
  implemented: false,
  effects: [],
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
  Scrapper: [ID.FUNCTION_GYRO, ID.FUNCTION_GYRO_TOOL_BELT_SKILL, ID.FUNCTION_GYRO_ID_72103, ID.FUNCTION_GYRO_ID_72114],
  Mechanist: [ID.CRASH_DOWN, ID.RECALL_MECH, ID.MECH_SUPPORT_DEPTH_CHARGES],
  Amalgam: [ID.EVOLVE, ID.EVOLVE_ID_76651, ID.LOCKED, ID.LOCKED_ID_77107, ID.LOCKED_ID_77388]
});

const SPECIALIZATION_ONLY_SKILL_OWNERS = createSpecializationSkillOwners(SPECIALIZATION_ONLY_SKILLS);

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

interface EngineerModuleDataOptions extends ProfessionModuleDataOptions {
  readonly autoattackChains?: NativeAutoattackChains;
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

/** Normalizes profession-specific handler ownership before mechanics enter the shared catalog. */
function normalizeMechanics(
  mechanics: Readonly<Record<string, SkillFragment>>
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanics).map(([id, mechanic]) => {
        const declared = byId.get(Number(id));

        // Focused Devastation is a derived packet and must not appear as a manually castable skill.
        if (Number(id) === ID.FOCUSED_DEVASTATION) {
          return [
            id,
            {
              ...mechanic,
              simulatorExcluded: true
            }
          ];
        }

        if (!declared?.categories?.includes('Morph')) {
          return [id, mechanic];
        }

        // All selectable Amalgam morphs share the stateful morph activation handler.
        return [
          id,
          {
            ...mechanic,
            handlerId: 'engineer.amalgam-morph'
          }
        ];
      })
    )
  );
}

export const ENGINEER_GENERATED_SKILL_IDS = Object.freeze([...generatedIds]);

/** Builds one Engineer module's catalog slice from shared API data and module-owned mechanics. */
export function createEngineerModuleData(
  id: string,
  {
    skillMechanics,
    balanceProfiles = [],
    extraSkills = [],
    autoattackChains,
    skillNameOverrides
  }: EngineerModuleDataOptions
) {
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    sharedExtraSkills: supplemental,
    skillMechanics: normalizeMechanics(skillMechanics),
    balanceProfiles,
    extraSkills,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === 'Core' ? WEAPON_DATA : {}),
    ...(autoattackChains ? { autoattackChains } : {}),
    ...(skillNameOverrides ? { skillNameOverrides } : {})
  });
}
