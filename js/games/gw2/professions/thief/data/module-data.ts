import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import {
  createFlipParentMap,
  createProfessionModuleDataFactory,
  defineProfessionWeapons
} from '#gw2/professions/shared/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/professions/shared/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/thief/data/thief-api-metadata.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { THIEF_SUPPLEMENTAL_SKILLS } from '#gw2/professions/thief/data/thief-supplemental-skills.js';
import { TRAITS } from '#gw2/professions/thief/data/traits-data.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Link dual-wield openers to their follow-ups for flip metadata and opener detection.
const DUAL_FOLLOWUP_BY_PARENT: Readonly<Record<number, SkillId>> = Object.freeze({
  [ID.SHADOW_STRIKE]: ID.REPEATER_ID_59526,
  [ID.FLANKING_STRIKE]: ID.LARCENOUS_STRIKE,
  [ID.MEASURED_SHOT]: ID.ENDLESS_NIGHT
});

const WEAPON_FLIP_BY_PARENT: Readonly<Record<number, SkillId>> = Object.freeze({
  ...DUAL_FOLLOWUP_BY_PARENT,
  [ID.INFILTRATORS_STRIKE]: ID.INFILTRATORS_RETURN,
  [ID.CLUSTER_BOMB]: ID.DETONATE_CLUSTER,
  [ID.DEBILITATING_ARC]: ID.HELMET_BREAKER,
  [ID.SNIPERS_COVER]: ID.DEATHS_ADVANCE
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

const PATCH_AUTHORING_EXCLUDED_SKILL_IDS = new Set<SkillId>([
  ID.STEAL_ID_13109,
  ID.LESSER_CALTROPS,
  ID.LESSER_HASTE,
  ID.PULMONARY_IMPACT_TRAIT_SKILL,
  ID.DASH_TRAIT_SKILL,
  ID.BURST_OF_SHADOWS,
  ID.ANTIVENOM_DRAUGHT_BACKFIRED,
  ID.UNSTABLE_SKRITT_BOMB,
  ID.STONE_SUMMIT_CANNON_ID_77092,
  ID.METAL_LEGION_GUITAR_ID_76591
]);

const generatedSource: readonly ThiefSkill[] = SKILLS.map((skill) => ({
  ...skill,
  flipSkillId:
    // Supply the missing forward link so the palette can replace the equipped utility.
    (skill.id === ID.FIST_FLURRY ? ID.PALM_STRIKE : null) ??
    WEAPON_FLIP_BY_PARENT[Number(skill.id)] ??
    (['Weapon', 'Profession'].includes(skill.type || '') ? null : skill.flipSkillId)
}));

const allDeclared = [...generatedSource, ...THIEF_SUPPLEMENTAL_SKILLS];
const declaredIds = new Set(allDeclared.map((skill) => skill.id));
const flipParentById = createFlipParentMap(allDeclared);
const normalize = (skill: ThiefSkill): ThiefSkill => ({
  ...skill,
  ...scepterAutoattackMetadata(skill),
  ...spearWeaponBarMetadata(skill),
  ...(skill.cooldown == null && skill.ammoRecharge == null
    ? {}
    : {
        cooldown: gw2BaseRecharge(skill)
      }),
  flipParentId: flipParentById.get(skill.id) ?? null,
  dualWieldOpener: Object.hasOwn(DUAL_FOLLOWUP_BY_PARENT, skill.id),
  // Keep zero costs declared too, so later patches can price a free skill without a second cost source.
  ...(skill.initiativeCost != null
    ? { cost: { resource: 'initiative', skillAmount: 'initiativeCost', spendOn: 'castStart' } as const }
    : {}),
  ...((skill.initiativeCost || 0) > 0
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

const supplemental: readonly ThiefSkill[] = THIEF_SUPPLEMENTAL_SKILLS.map((skill) => ({
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
    ID.FORGED_SURFER_DASH,
    ID.HOLO_DANCER_DECOY,
    ID.EXALTED_HAMMER,
    ID.CHAK_SHIELD,
    ID.ZEPHYRITE_SUN_CRYSTAL,
    ID.UNSTABLE_SKRITT_BOMB,
    ID.RESHUFFLE,
    ID.SUMMON_KRYPTIS_TURRET,
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

// Keep Thief mechanics typed through module registration and both catalog selections.
const createModuleData = createProfessionModuleDataFactory<ThiefSkill>({
  generatedSkills: generated,
  sharedExtraSkills: supplemental,
  traits: TRAITS,
  specializations: SPECIALIZATIONS,
  specializationOnlySkills: SPECIALIZATION_ONLY_SKILLS,
  core: {
    ...WEAPON_DATA,
    // Name-based requests select the opener rather than its identically named follow-up.
    skillNameOverrides: { 'Spinning Axe': ID.SPINNING_AXE_ID_71967 }
  }
});

// Normalize generated and supplemental Thief mechanics into one specialization
// module with shared traits, profiles, and ownership filters.
export function createThiefModuleData(
  id: string,
  { skillMechanics, ...options }: ProfessionModuleDataOptions<ThiefSkill>
) {
  const mechanics = Object.fromEntries(
    Object.entries(skillMechanics)
      .filter(([skillId]) => declaredIds.has(Number(skillId)))
      .map(([skillId, mechanics]) => [
        skillId,
        {
          ...mechanics,
          // Shared admission and payment read the same price as profession-owned rewards.
          ...(mechanics.initiativeCost != null
            ? { cost: { resource: 'initiative', skillAmount: 'initiativeCost', spendOn: 'castStart' } as const }
            : {}),
          ...((mechanics.initiativeCost || 0) > 0
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

  return createModuleData(id, {
    ...options,
    skillMechanics: mechanics
  });
}
