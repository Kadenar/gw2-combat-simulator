import { createNativeModuleData } from '#gw2/platform/profession-definition/catalog.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import { createFlipParentMap, defineProfessionWeapons } from '#gw2/professions/lib/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/professions/lib/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/thief/data/thief-api-metadata.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { THIEF_SUPPLEMENTAL_SKILLS } from '#gw2/professions/thief/data/thief-supplemental-skills.js';
import { TRAITS } from '#gw2/professions/thief/data/traits-data.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/core/mechanics/spear-chain.js';
import { thiefWeaponSkillMatchesSet as thiefCoreWeaponSkillMatchesSet } from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import { deadeyeWeaponSkillMatchesSet } from '#gw2/professions/thief/specializations/deadeye/mechanics/weapon-state.js';
import type { CatalogEntity, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ThiefSkill, ThiefWeaponMatcherContext } from '#gw2/professions/thief/types.js';

export function thiefWeaponSkillMatchesSet(
  skill: ThiefSkill,
  pair: readonly (string | undefined)[] = [],
  context: ThiefWeaponMatcherContext = {}
): boolean {
  const specialization = context.specialization || context.config?.specialization || 'Core';
  if (specialization === 'Deadeye') return deadeyeWeaponSkillMatchesSet(skill, pair, context);
  // Family dispatch excludes Deadeye-owned malicious replacements from every other runtime.
  if (skill.stealthAttack && skill.malicious) return false;
  return thiefCoreWeaponSkillMatchesSet(skill, pair, context);
}

const DUAL_FOLLOWUP_BY_PARENT: Readonly<Record<number, SkillId>> = Object.freeze({
  13010: 59526,
  13016: 13007,
  63267: 63128
});

const DUAL_FOLLOWUP_IDS = new Set<SkillId>(Object.values(DUAL_FOLLOWUP_BY_PARENT));

const WEAPON_FLIP_BY_PARENT: Readonly<Record<number, SkillId>> = Object.freeze({
  ...DUAL_FOLLOWUP_BY_PARENT,
  [ID.INFILTRATORS_STRIKE]: ID.INFILTRATORS_RETURN,
  [ID.CLUSTER_BOMB]: ID.DETONATE_CLUSTER,
  [ID.DEBILITATING_ARC]: ID.HELMET_BREAKER,
  [ID.SNIPERS_COVER]: ID.DEATHS_ADVANCE
});

const WEAPON_FLIP_DURATION_BY_PARENT: Readonly<Record<number, number>> = Object.freeze({
  [ID.INFILTRATORS_STRIKE]: 15,
  [ID.CLUSTER_BOMB]: 1,
  [ID.DEBILITATING_ARC]: 3,
  [ID.SNIPERS_COVER]: 5
});

// Derive Scepter autoattack chain metadata from generated skill identity so the
// catalog exposes the correct root, next step, and timing.
function scepterAutoattackMetadata(skill: ThiefSkill): Partial<ThiefSkill> {
  const chain = new Map<
    SkillId,
    {
      step: number;
      next: SkillId | null;
    }
  >([
    [
      ID.SHADOW_BOLT,
      {
        step: 1,
        next: ID.DOUBLE_BOLT
      }
    ],
    [
      ID.DOUBLE_BOLT,
      {
        step: 2,
        next: ID.TRIPLE_BOLT
      }
    ],
    [
      ID.TRIPLE_BOLT,
      {
        step: 3,
        next: null
      }
    ]
  ]).get(skill.id);

  return chain
    ? {
        chainRoot: ID.SHADOW_BOLT,
        chainStep: chain.step,
        nextChainId: chain.next
      }
    : {};
}

function spearWeaponBarMetadata(skill: ThiefSkill): Partial<ThiefSkill> {
  const stage = spearChainStageForSkill(skill.id);

  if (stage == null) {
    return {};
  }

  return {
    weaponBarChainRootId: skill.slot === 'Weapon_2' ? ID.MANTIS_STING : ID.UNSUSPECTING_STRIKE,
    weaponBarChainStep: stage + 1
  };
}

const SIMULATOR_EXCLUDED_SKILL_NAMES = new Set([
  'Prepare Seal Area',
  'Prepare Shadow Portal',
  'Seal Area',
  'Shadow Portal',
  'Shadow Refuge',
  'Shadow Return',
  'Shadowstep',
  'Smoke Screen'
]);

// Context-specific variants remain distinct records but are not valid manual simulator selections.
const SIMULATOR_EXCLUDED_SKILL_IDS = new Set<SkillId>([45094, 76550, 76601, 76800, 76900, 77288]);

const PATCH_AUTHORING_EXCLUDED_SKILL_IDS = new Set<SkillId>([
  ID.BRANCH_LEAP,
  ID.THROW_CHAIN,
  ID.EAT_EGG,
  ID.ICE_SHARD_STAB,
  ID.MACE_HEAD_CRACK,
  ID.HEALING_SEED,
  ID.SKULL_FEAR,
  ID.BLINDING_TUFT,
  ID.WHIRLING_STRIKE,
  ID.ESSENCE_SAP,
  ID.BONE_CRACK,
  ID.BRANCH_BASH,
  ID.DRINK_STOLEN_SKILL,
  ID.CLUB_SHOCK_WAVE,
  ID.THROW_CORAL_SHARD,
  ID.THROW_CRYSTAL_SHARD_STOLEN_SKILL,
  ID.THROW_FEATHERS,
  ID.THROW_GEAR_STOLEN_SKILL,
  ID.THROW_LAVA_ROCK,
  ID.SHOOT_RIFLE,
  ID.THROW_ROCK_STOLEN_SKILL_KNOCKDOWN,
  ID.RUSTY_SCRAP_STRIKE,
  ID.THROW_SCALE,
  ID.USE_SCEPTER,
  ID.USE_STAFF,
  ID.TOOTH_STAB,
  ID.EXPLODING_VENOM_SACK,
  ID.THROW_VINE_STOLEN_SKILL,
  ID.THROW_ROCK_STOLEN_SKILL_DAZE,
  ID.THROW_NET,
  ID.SHADOW_ASSAULT,
  ID.FLANKING_DIVE,
  ID.TOW_LINE,
  ID.PIERCING_SHOT,
  ID.DELUGE,
  ID.ESCAPE,
  ID.CRIPPLING_SHOT_THIEF_HARPOON_GUN_SKILL,
  ID.INK_SHOT,
  ID.SMOKE_TRAIL,
  ID.STEAL_ID_13109,
  ID.STAB_THIEF_SPEAR_SKILL,
  ID.JAB_THIEF_SKILL,
  ID.POISON_TIP_STRIKE,
  ID.NINE_TAILED_STRIKE,
  ID.BREAK_STANCE,
  ID.LESSER_CALTROPS,
  ID.THROW_GUNK_ID_16460,
  ID.ICE_WURM_VENOM_TRAP,
  ID.LESSER_HASTE,
  ID.PULMONARY_IMPACT_TRAIT_SKILL,
  ID.DASH_TRAIT_SKILL,
  ID.TRAIL_OF_KNIVES_DOPPELGANGER,
  ID.SOHOTHIN_BLOSSOM,
  ID.LIFT_PIN,
  ID.SOUL_STONE_VENOM,
  ID.DETONATE_PLASMA,
  ID.THROW_MAGNETIC_BOMB,
  ID.UNSTABLE_ARTIFACT,
  ID.HOOKED_SPEAR,
  ID.BURST_OF_SHADOWS,
  ID.THROW_ENCHANTED_ICE,
  ID.THROW_UNSTABLE_REAGENT,
  ID.BLESSING_SEED,
  ID.DRINK_AMBROSIA,
  ID.TIME_IN_A_BOTTLE,
  ID.THROW_CURSED_ARTIFACT,
  ID.LIFT_PIN_HERO_CHALLENGE,
  ID.ANTIVENOM_DRAUGHT_BACKFIRED,
  ID.UNSTABLE_SKRITT_BOMB,
  ID.STONE_SUMMIT_CANNON_ID_77092,
  ID.METAL_LEGION_GUITAR_ID_76591
]);

const generatedSource: readonly ThiefSkill[] = SKILLS.filter(
  (skill) => !SIMULATOR_EXCLUDED_SKILL_NAMES.has(skill.name) && !SIMULATOR_EXCLUDED_SKILL_IDS.has(skill.id)
).map((skill) => ({
  ...skill,
  flipSkillId:
    WEAPON_FLIP_BY_PARENT[Number(skill.id)] ??
    (['Weapon', 'Profession'].includes(skill.type || '') ? null : skill.flipSkillId)
}));

const supplementalSource: readonly ThiefSkill[] = THIEF_SUPPLEMENTAL_SKILLS.filter(
  (skill) => !SIMULATOR_EXCLUDED_SKILL_NAMES.has(skill.name)
);

const allDeclared = [...generatedSource, ...supplementalSource];
const declaredIds = new Set(allDeclared.map((skill) => skill.id));
const flipParentById = createFlipParentMap(allDeclared);
const normalize = (skill: ThiefSkill): ThiefSkill => ({
  ...skill,
  ...scepterAutoattackMetadata(skill),
  ...spearWeaponBarMetadata(skill),
  ...(skill.recharge == null && skill.ammoRecharge == null
    ? {}
    : {
        cooldown: gw2BaseRecharge(skill)
      }),
  flipParentId: flipParentById.get(skill.id) ?? null,
  dualWieldOpener: Object.hasOwn(DUAL_FOLLOWUP_BY_PARENT, skill.id),
  dualWieldFollowup: DUAL_FOLLOWUP_IDS.has(skill.id),
  flipDuration: WEAPON_FLIP_DURATION_BY_PARENT[Number(skill.id)] ?? skill.flipDuration,
  ...(Number(skill.initiativeCost || 0) > 0
    ? {
        resource: 'initiative'
      }
    : {})
});

const generated: readonly ThiefSkill[] = generatedSource.map((skill) => ({
  ...normalize(skill),
  effects: [],
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id)
    ? {
        patchAuthoringExcluded: true
      }
    : {})
}));

const supplemental: readonly ThiefSkill[] = supplementalSource.map((skill) => ({
  ...normalize(skill),
  ...(PATCH_AUTHORING_EXCLUDED_SKILL_IDS.has(skill.id)
    ? {
        patchAuthoringExcluded: true
      }
    : {})
}));

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Deadeye: [
    ID.DEADEYES_MARK,
    ID.MALICIOUS_DEATHS_JUDGMENT,
    ID.MALICIOUS_ASHEN_ASSAULT,
    ID.MALICIOUS_SURPRISE_SHOT,
    ID.MALICIOUS_SNEAK_ATTACK,
    ID.MALICIOUS_BACKSTAB,
    ID.MALICIOUS_TACTICAL_STRIKE,
    ID.MALICIOUS_SHADOWSQUALL,
    ID.MALICIOUS_HOOK_STRIKE,
    ID.MALICIOUS_CUNNING_SALVO
  ],
  Specter: [ID.ETERNAL_NIGHT, ID.GRASPING_SHADOWS, ID.DAWNS_REPOSE, ID.MIND_SHOCK, ID.HAUNT_SHOT],
  Antiquary: [
    ID.FORGED_SURFER_DASH_ID_76633,
    ID.HOLO_DANCER_DECOY,
    ID.EXALTED_HAMMER_ID_76702,
    ID.CHAK_SHIELD,
    ID.ZEPHYRITE_SUN_CRYSTAL,
    ID.UNSTABLE_SKRITT_BOMB,
    ID.RESHUFFLE,
    ID.SUMMON_KRYPTIS_TURRET_ID_77192,
    ID.MISTBURN_MORTAR,
    ID.SKRITT_SWIPE,
    ID.ZEPHYRITE_SUN_CRYSTAL_ID_78309
  ]
});

const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh',
  Dagger: 'mh+oh',
  Pistol: 'mh+oh',
  Rifle: '2h',
  Scepter: 'mh',
  Shortbow: '2h',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh'
});

// Normalize generated and supplemental Thief mechanics into one specialization
// module with shared traits, profiles, and ownership filters.
export function createThiefModuleData(
  id: string,
  { skillMechanics, extraSkills = [], balanceProfiles = [] }: ProfessionModuleDataOptions<ThiefSkill>
) {
  const terrestrialMechanics = Object.fromEntries(
    Object.entries(skillMechanics)
      .filter(([skillId]) => declaredIds.has(Number(skillId)))
      .map(([skillId, mechanics]) => [
        skillId,
        {
          ...mechanics,
          ...(Number(mechanics.initiativeCost || 0) > 0
            ? {
                resource: 'initiative'
              }
            : {}),
          // API artifact aliases can claim weapon slots; the simulator exposes every artifact on Antiquary's profession bar.
          ...(mechanics.artifactKind
            ? {
                type: 'Profession',
                slot: 'Profession_2'
              }
            : {})
        }
      ])
  );

  return createNativeModuleData({
    id,
    generatedSkills: generated,
    sharedExtraSkills: supplemental,
    skillMechanics: terrestrialMechanics,
    extraSkills,
    balanceProfiles,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    ...(id === 'Core' ? WEAPON_DATA : {})
  });
}
