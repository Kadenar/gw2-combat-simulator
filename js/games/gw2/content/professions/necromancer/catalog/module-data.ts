import { createNativeModuleData } from '#gw2/integrations/patches/authoring/catalog.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import {
  createFlipParentMap,
  createSpecializationSkillOwners,
  defineProfessionWeapons
} from '#gw2/content/professions/lib/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/content/professions/lib/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/content/professions/necromancer/data/necromancer-api-metadata.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import { NECROMANCER_SUPPLEMENTAL_SKILLS } from '#gw2/content/professions/necromancer/data/necromancer-supplemental-skills.js';
import { TRAITS } from '#gw2/content/professions/necromancer/data/traits-data.js';
import type { CatalogEntity, Skill, SkillFragment, SkillId } from '#gw2/platform/engine/types.js';
import type { NativeAutoattackChains } from '#gw2/integrations/patches/authoring/module-types.js';

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

const flipParentById = createFlipParentMap(allSkills, {
  include(parent, child) {
    return child.name !== parent.name && !STATIC_REPLACEMENT_PAIRS.has(`${parent.id}:${parent.flipSkillId}`);
  }
});

const generated: readonly Skill[] = allSkills.map((skill) => {
  const canonicalAliasId = CANONICAL_ALIAS_ID_BY_NAME[skill.name];

  const flipParentId = flipParentById.get(skill.id);

  return {
    ...skill,
    cooldown: gw2BaseRecharge(skill),
    flipParentId: flipParentId ?? null,
    flipParent: flipParentId == null ? '' : generatedById.get(flipParentId)?.name || '',
    simulatorAliasOfId: canonicalAliasId && canonicalAliasId !== skill.id ? canonicalAliasId : null,
    simulatorExcluded:
      NECROMANCER_NON_DPS_SKILL_NAMES.has(skill.name) || Boolean(canonicalAliasId && canonicalAliasId !== skill.id),
    ...(NECROMANCER_NON_DPS_SKILL_NAMES.has(skill.name)
      ? {
          patchAuthoringExcluded: true
        }
      : {}),
    implemented: false,
    effects: []
  };
});

const SPECIALIZATION_ONLY_SKILLS: Readonly<Record<string, readonly SkillId[]>> = Object.freeze({
  Scourge: [ID.MANIFEST_SAND_SHADE_ID_42297, ID.MANIFEST_SAND_SHADE_ID_46473, ID.MANIFEST_SAND_SHADE_ID_46474]
});

const SPECIALIZATION_ONLY_SKILL_OWNERS = createSpecializationSkillOwners(SPECIALIZATION_ONLY_SKILLS);

const WEAPON_DATA = defineProfessionWeapons({
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

interface NecromancerModuleDataOptions extends ProfessionModuleDataOptions {
  readonly autoattackChains?: NativeAutoattackChains;
}

/** Applies shared shroud weapon attribution to module-owned Necromancer skill mechanics. */
function applyNecromancerSkillDefaults(
  mechanicsById: Readonly<Record<string, SkillFragment>>
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanicsById).map(([skillId, mechanics]) => {
        // Real shroud forms share Hammer weapon strength; shade and transform mechanics keep their declared profile.
        const shroudSkillWeapon = ['death', 'reaper', 'harbinger'].includes(String(mechanics.shroud || ''))
          ? 'Hammer'
          : null;

        return [
          skillId,
          {
            ...mechanics,
            ...(shroudSkillWeapon
              ? {
                  skillWeapon: shroudSkillWeapon
                }
              : {})
          }
        ];
      })
    )
  );
}

/** Builds one Necromancer module's catalog slice from shared API data and module-owned mechanics. */
export function createNecromancerModuleData(
  id: string,
  { skillMechanics, extraSkills = [], balanceProfiles = [], autoattackChains }: NecromancerModuleDataOptions
) {
  return createNativeModuleData({
    id,
    generatedSkills: generated,
    skillMechanics: applyNecromancerSkillDefaults(skillMechanics),
    extraSkills,
    balanceProfiles,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === 'Core' ? WEAPON_DATA : {}),
    ...(autoattackChains ? { autoattackChains } : {})
  });
}
