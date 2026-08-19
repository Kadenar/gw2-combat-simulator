import { createNativeModuleData } from '../../platform/gw2/native-profession.js';
import { SKILLS, SPECIALIZATIONS } from './data/necromancer-api-metadata.js';
import { NECROMANCER_SKILL_IDS as ID } from './data/ids.js';
import { NECROMANCER_SUPPLEMENTAL_SKILLS } from './data/necromancer-supplemental-skills.js';
import { TRAITS } from './data/traits-data.js';
import type {
  BalanceProfile,
  CatalogEntity,
  Skill,
  SkillFragment,
  SkillHandlerStrategy,
  SkillId
} from '../../platform/engine/types.js';
import type { NativeAutoattackChains } from '../../platform/gw2/native-profession.js';

export const NECROMANCER_NON_DPS_SKILL_NAMES = Object.freeze(
  new Set([
    'Well of Blood',
    'Consume Conditions',
    'Spectral Armor',
    'Spectral Walk',
    'Spectral Recall',
    'Well of Power',
    'Weapon of Warding',
    'Weapon of Remedy',
    "Xinrae's Weapon"
  ])
);

const CANONICAL_ALIAS_ID_BY_NAME: Readonly<Record<string, SkillId>> = Object.freeze({
  'Manifest Sand Shade': ID.MANIFEST_SAND_SHADE
});
const STATIC_REPLACEMENT_PAIRS = new Set<string>([
  `${ID.LIFE_BLAST}:${ID.DHUUMFIRE_BLAST}`,
  `${ID.FEAST_OF_CORRUPTION}:${ID.DEVOURING_DARKNESS}`,
  `${ID.DESERT_SHROUD}:${ID.SANDSTORM_SHROUD}`
]);
const UNSUPPORTED_SKILL_IDS = new Set<SkillId>([
  ID.SUMMON_FLESH_WURM,
  ID.NECROTIC_TRAVERSAL,
  ID.CORRUPT_BOON,
  ID.EPIDEMIC,
  ID.SPECTRAL_RING
]);
const allSkills: readonly Skill[] = Object.freeze(
  [...SKILLS, ...NECROMANCER_SUPPLEMENTAL_SKILLS]
    .filter((skill) => !UNSUPPORTED_SKILL_IDS.has(skill.id))
    .sort((left, right) => {
      const leftCanonical = CANONICAL_ALIAS_ID_BY_NAME[left.name] === left.id ? 0 : 1;
      const rightCanonical = CANONICAL_ALIAS_ID_BY_NAME[right.name] === right.id ? 0 : 1;
      return leftCanonical - rightCanonical || Number(left.id) - Number(right.id);
    })
);
const generatedById = new Map<SkillId, Skill>(allSkills.map((skill) => [skill.id, skill]));
const flipParentById = new Map<SkillId, SkillId>();
for (const skill of allSkills) {
  const child = skill.flipSkillId == null ? undefined : generatedById.get(skill.flipSkillId);
  if (
    child &&
    skill.flipSkillId !== skill.nextChainId &&
    child.name !== skill.name &&
    !STATIC_REPLACEMENT_PAIRS.has(`${skill.id}:${skill.flipSkillId}`)
  ) {
    flipParentById.set(skill.flipSkillId!, skill.id);
  }
}

const generated: readonly Skill[] = allSkills.map((skill) => {
  const canonicalAliasId = CANONICAL_ALIAS_ID_BY_NAME[skill.name];
  const flipParentId = flipParentById.get(skill.id);
  return {
    ...skill,
    cooldown: Number(skill.ammo || 0) > 0 ? skill.ammoRecharge || skill.recharge : skill.recharge,
    flipParentId: flipParentId ?? null,
    flipParent: flipParentId == null ? '' : generatedById.get(flipParentId)?.name || '',
    simulatorAliasOfId: canonicalAliasId && canonicalAliasId !== skill.id ? canonicalAliasId : null,
    simulatorExcluded:
      NECROMANCER_NON_DPS_SKILL_NAMES.has(skill.name) || Boolean(canonicalAliasId && canonicalAliasId !== skill.id),
    ...(NECROMANCER_NON_DPS_SKILL_NAMES.has(skill.name) ? { patchAuthoringExcluded: true } : {}),
    implemented: false,
    effects: []
  };
});

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Scourge: [ID.MANIFEST_SAND_SHADE_ID_42297, ID.MANIFEST_SAND_SHADE_ID_46473, ID.MANIFEST_SAND_SHADE_ID_46474]
});
const SPECIALIZATION_ONLY_SKILL_OWNERS = Object.freeze(
  Object.fromEntries(
    Object.entries(SPECIALIZATION_ONLY_SKILLS).flatMap(([owner, skillIds]) =>
      skillIds.map((skillId) => [String(skillId), owner])
    )
  )
);
const WEAPONS = Object.freeze([
  'Axe',
  'Dagger',
  'Focus',
  'Greatsword',
  'Pistol',
  'Scepter',
  'Spear',
  'Staff',
  'Sword',
  'Torch',
  'Warhorn'
]);
const WEAPON_HANDS = Object.freeze({
  Axe: 'mh',
  Dagger: 'mh+oh',
  Focus: 'oh',
  Greatsword: '2h',
  Pistol: 'mh',
  Scepter: 'mh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh',
  Warhorn: 'oh'
});

interface NecromancerModuleDataOptions {
  readonly skillMechanics: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly handlers?:
    ReadonlyMap<string, SkillHandlerStrategy<never>> | Readonly<Record<string, SkillHandlerStrategy<never>>>;
  readonly autoattackChains?: NativeAutoattackChains;
}

function applyNecromancerSkillDefaults(
  mechanicsById: Readonly<Record<string, SkillFragment>>
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanicsById).map(([skillId, mechanics]) => {
        const shroudSkillWeapon = ['death', 'reaper', 'harbinger'].includes(String(mechanics.shroud || ''))
          ? 'Hammer'
          : null;
        return [
          skillId,
          {
            ...mechanics,
            ...(shroudSkillWeapon ? { skillWeapon: shroudSkillWeapon } : {})
          }
        ];
      })
    )
  );
}

export function createNecromancerModuleData(
  id: string,
  { skillMechanics, extraSkills = [], balanceProfiles = [], handlers, autoattackChains }: NecromancerModuleDataOptions
) {
  return createNativeModuleData<never>({
    id,
    generatedSkills: generated,
    skillMechanics: applyNecromancerSkillDefaults(skillMechanics),
    extraSkills,
    balanceProfiles,
    handlers,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === 'Core' ? { weapons: WEAPONS, weaponHands: WEAPON_HANDS } : {}),
    ...(autoattackChains ? { autoattackChains } : {})
  });
}
