import { createNativeModuleData } from '../../platform/gw2/native-profession.js';
import { SKILLS, SPECIALIZATIONS } from './data/engineer-api-metadata.js';
import { ENGINEER_SUPPLEMENTAL_SKILLS } from './data/engineer-supplemental-skills.js';
import { ENGINEER_SKILL_IDS as ID } from './data/ids.js';
import { TRAITS } from './data/traits-data.js';
import type {
  BalanceProfile,
  CatalogEntity,
  Skill,
  SkillFragment,
  SkillId,
  SkillHandlerStrategy
} from '../../platform/engine/types.js';
import type { NativeAutoattackChains } from '../../platform/gw2/native-profession.js';

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
const UNSELECTABLE_SLOT_SKILLS = new Set([
  'Elixir B',
  'Elixir C',
  'Elixir S',
  'Elixir U',
  'Elixir R',
  'Utility Goggles',
  'Rocket Boots'
]);

// These API records have numeric definitions but no path into the simulator.
const PATCH_AUTHORING_EXCLUDED_SKILL_IDS = new Set<SkillId>([
  ID.JUMP_SHOT_ID_5817,
  ID.ELIXIR_B,
  ID.ELIXIR_C,
  ID.ELIXIR_S,
  ID.ELIXIR_U,
  ID.UTILITY_GOGGLES,
  ID.TOSS_ELIXIR_R,
  ID.AUTOMATIC_FIRE,
  ID.THUMP,
  ID.ROCKET_BOOTS,
  ID.TOSS_ELIXIR_B,
  ID.ELIXIR_R,
  ID.TOSS_ELIXIR_C,
  ID.TOSS_ELIXIR_U,
  ID.TOSS_ELIXIR_S,
  ID.CLEANSING_BURST,
  ID.ROCKET_KICK,
  ID.TOSS_ELIXIR_C_ID_6077,
  ID.DETONATE_ELIXIR_C,
  ID.DETONATE_ELIXIR_B,
  ID.DETONATE_ELIXIR_S,
  ID.DETONATE_ELIXIR_R,
  ID.DETONATE_ELIXIR_U,
  ID.DETONATE_ELIXIR_H,
  ID.TOSS_ELIXIR_U_ID_6089,
  ID.TOSS_ELIXIR_S_ID_6090,
  ID.TOSS_ELIXIR_R_ID_6091,
  ID.TOSS_ELIXIR_B_ID_6092,
  ID.HARPOON_TURRET,
  ID.DETONATE_HARPOON_TURRET,
  ID.AUTOMATIC_FIRE_HARPOON_TURRET,
  ID.DEPLOY_MINE,
  ID.HARPOON_ENGINEER_SKILL,
  ID.WITHERING_PLAGUE,
  ID.PLAGUE_OF_DARKNESS,
  ID.PLAGUE_OF_PESTILENCE,
  ID.CONFUSING_SPEECH,
  ID.PAIN_TRANSFERENCE,
  ID.VENT_RADIATION,
  ID.INVIGORATING_ROAR,
  ID.BOOBY_TRAP_CHARR_SKILL,
  ID.HIDDEN_PISTOLS,
  ID.BLESSING_OF_DWAYNA,
  ID.BLESSING_OF_KORMIR,
  ID.BLESSING_OF_LYSSA,
  ID.EAT_WURM_EGG,
  ID.EAT_OWL_EGG,
  ID.THROW_VINE,
  ID.VINE_SHIELD,
  ID.LEAFY_BANDAGE,
  ID.LESSER_ELIXIR_B,
  ID.ALLY_WARD,
  ID.STATIC_DISCHARGE_TRAIT_SKILL,
  ID.PLAGUE,
  ID.SNOWMAN_TURRET_SKILL,
  ID.DETONATE_SNOWMAN_TURRET,
  ID.MAGNETIC_BOMB_TRAIT_SKILL,
  ID.SUPERSPEED_TRAIT_SKILL,
  ID.FIRE_SHIELD_TRAIT_SKILL,
  ID.MAGNETIC_AURA_TRAIT_SKILL,
  ID.GLUE_TRAIL,
  ID.BUNKER_DOWN_TRAIT_SKILL,
  ID.OVERFUELED_FLAME_JET,
  ID.DETONATE_SUPPLY_CRATE_TURRETS,
  ID.ROCKET_BOOTS_ID_29522,
  ID.UTILITY_GOGGLES_ID_29591,
  ID.INVISIBLE_ANALYSIS,
  ID.CLEANSING_PULSE,
  ID.DETONATE_ELIXIR_X,
  ID.LESSER_UTILITY_GOGGLES,
  ID.DROP_GUNK,
  ID.PERSONAL_BATTERING_RAM_ID_29991,
  ID.BANDAGE_TRAIT_SKILL,
  ID.FLASHBANG,
  ID.OVERCHARGE_SUPPLY_CRATE,
  ID.LONG_FUSED_POWDER_PACK,
  ID.SLICK_SHOES_ID_30828,
  ID.A_E_D_ID_30881,
  ID.DEPLOY_MINE_ID_30893,
  ID.THROW_JUNK_DOPPELGANGER,
  ID.CONTROLLED_ANALYSIS,
  ID.LESSER_ELIXIR_C,
  ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL
]);

const generatedIds = new Set<SkillId>(SKILLS.map((skill) => skill.id));
const generatedSource = SKILLS.map((skill) => ({ ...skill }));
const allDeclared: readonly Skill[] = [...generatedSource, ...ENGINEER_SUPPLEMENTAL_SKILLS];
const byId = new Map<SkillId, Skill>(allDeclared.map((skill) => [skill.id, skill]));
const flipParentById = new Map<SkillId, SkillId>();
for (const skill of allDeclared) {
  if (skill.flipSkillId != null && skill.flipSkillId !== skill.nextChainId && byId.has(skill.flipSkillId)) {
    flipParentById.set(skill.flipSkillId, skill.id);
  }
}

const preferredFlipParentById = new Map<SkillId, SkillId>([
  [ID.DETONATE_RIFLE_TURRET, ID.RIFLE_TURRET],
  [ID.DETONATE_FLAME_TURRET, ID.FLAME_TURRET],
  [ID.DETONATE_NET_TURRET, ID.NET_TURRET],
  [ID.DETONATE_THUMPER_TURRET, ID.THUMPER_TURRET],
  [ID.DETONATE_HEALING_TURRET, ID.HEALING_TURRET],
  [ID.DETONATE_ROCKET_TURRET, ID.ROCKET_TURRET],
  [ID.DETONATE, ID.THROW_MINE],
  [ID.STOW_FLAMETHROWER, ID.FLAMETHROWER],
  [ID.ELECTRIC_ARTILLERY, ID.LIGHTNING_ROD]
]);
const resolvedFlipParentId = (skillId: SkillId): SkillId | null =>
  preferredFlipParentById.get(skillId) ?? flipParentById.get(skillId) ?? null;

const generated: readonly Skill[] = generatedSource.map((skill) => ({
  ...skill,
  cooldown: Number(skill.ammo) > 0 ? skill.ammoRecharge || skill.recharge : skill.recharge,
  flipParentId: resolvedFlipParentId(skill.id),
  implemented: false,
  effects: [],
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id) ? { patchAuthoringExcluded: true } : {}),
  ...(UNSELECTABLE_SLOT_SKILLS.has(skill.name) ? { slotSelectable: false } : {})
}));
const supplemental: readonly Skill[] = ENGINEER_SUPPLEMENTAL_SKILLS.map((skill) => ({
  ...skill,
  icon: ENGINEER_SKILL_ICON_OVERRIDES.get(skill.name) || skill.icon,
  flipParentId: resolvedFlipParentId(skill.id),
  slotSelectable: false,
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id) ? { patchAuthoringExcluded: true } : {})
}));

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Holosmith: [
    ID.DEACTIVATE_PHOTON_FORGE,
    ID.ENGAGE_PHOTON_FORGE,
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
  Scrapper: [ID.FUNCTION_GYRO, ID.FUNCTION_GYRO_ID_72103, ID.FUNCTION_GYRO_ID_72114],
  Mechanist: [ID.CRASH_DOWN, ID.RECALL_MECH, ID.MECH_SUPPORT_DEPTH_CHARGES],
  Amalgam: [ID.EVOLVE, ID.EVOLVE_ID_76651, ID.LOCKED, ID.LOCKED_ID_77107, ID.LOCKED_ID_77388]
});
const SPECIALIZATION_ONLY_SKILL_OWNERS = Object.freeze(
  Object.fromEntries(
    Object.entries(SPECIALIZATION_ONLY_SKILLS).flatMap(([owner, skillIds]) =>
      skillIds.map((skillId) => [String(skillId), owner])
    )
  )
);

const WEAPONS = Object.freeze(['Hammer', 'Mace', 'Pistol', 'Rifle', 'Shield', 'Shortbow', 'Spear', 'Sword']);
const WEAPON_HANDS = Object.freeze({
  Hammer: '2h',
  Mace: 'mh',
  Pistol: 'mh+oh',
  Rifle: '2h',
  Shield: 'oh',
  Shortbow: '2h',
  Spear: '2h',
  Sword: 'mh'
});

interface EngineerModuleDataOptions<TContext extends object> {
  readonly skillMechanics: Readonly<Record<string, SkillFragment>>;
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly extraSkills?: readonly Skill[];
  readonly handlers?:
    ReadonlyMap<string, SkillHandlerStrategy<TContext>> | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;
  readonly autoattackChains?: NativeAutoattackChains;
}

function normalizeMechanics(
  mechanics: Readonly<Record<string, SkillFragment>>
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanics).map(([id, mechanic]) => {
        const declared = byId.get(Number(id));
        if (Number(id) === ID.FOCUSED_DEVASTATION) {
          return [id, { ...mechanic, simulatorExcluded: true }];
        }

        if (declared?.categories?.includes('Turret') && Number.isFinite(Number(mechanic.paletteFlipSkillId))) {
          return [
            id,
            {
              ...mechanic,
              handlerId: 'engineer.turret-deploy',
              effects: []
            }
          ];
        }

        if (!declared?.categories?.includes('Morph')) return [id, mechanic];
        return [id, { ...mechanic, handlerId: 'engineer.amalgam-morph' }];
      })
    )
  );
}

export const ENGINEER_GENERATED_SKILL_IDS = Object.freeze([...generatedIds]);

export function createEngineerModuleData<TContext extends object>(
  id: string,
  {
    skillMechanics,
    balanceProfiles = [],
    extraSkills = [],
    handlers,
    autoattackChains
  }: EngineerModuleDataOptions<TContext>
) {
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    sharedExtraSkills: supplemental,
    skillMechanics: normalizeMechanics(skillMechanics),
    balanceProfiles,
    extraSkills,
    handlers,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === 'Core' ? { weapons: WEAPONS, weaponHands: WEAPON_HANDS } : {}),
    ...(autoattackChains ? { autoattackChains } : {})
  });
}
