import { createNativeModuleData } from '../../platform/gw2/authoring/catalog.js';
import {
  createFlipParentMap,
  createSpecializationSkillIds,
  createSpecializationSkillOwners,
  defineProfessionWeapons
} from '../lib/catalog-data.js';
import type { ProfessionModuleDataOptions } from '../lib/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from './data/warrior-api-metadata.js';
import { WARRIOR_SUPPLEMENTAL_SKILLS } from './data/warrior-supplemental-skills.js';
import { TRAITS } from './data/traits-data.js';
import { WARRIOR_CORE_SKILL_MECHANICS } from './core/skills.js';
import { BERSERKER_SKILL_MECHANICS } from './specializations/berserker/skills.js';
import { SPELLBREAKER_SKILL_MECHANICS } from './specializations/spellbreaker/skills.js';
import { BLADESWORN_SKILL_MECHANICS } from './specializations/bladesworn/skills.js';
import { PARAGON_SKILL_MECHANICS } from './specializations/paragon/skills.js';
import type { CatalogEntity, Skill, SkillId } from '../../platform/engine/types.js';
import type { NativeAutoattackChains } from '../../platform/gw2/authoring/module-types.js';

export const WARRIOR_NON_DPS_SKILL_NAMES = Object.freeze(new Set<string>());

const WARRIOR_SIMULATOR_EXCLUDED_SKILL_IDS = new Set<number>([
  14372, // "Shake It Off!"
  14392, // Endure Pain
  14406, // Berserker Stance
  14408, // Banner of Tactics
  14409, // "Fear Me!"
  14412, // Balanced Stance
  14528, // Banner of Defense
  14575, // "On My Mark!"
  41919, // Imminent Threat
  43745, // Sight beyond Sight
  45380, // Featherfoot Grace
  62804 // Electric Fence
]);

const WARRIOR_UNREACHABLE_PROFESSION_SKILL_IDS = new Set<SkillId>([
  14443, // Whirling Strike
  14469, // Forceful Shot
  30989, // Burning Shackles
  31048, // Wild Whirl
  39972, // Silencer
  41283, // Boon Crusher
  41543, // Wounding Strike
  43488, // Fleeting Stability
  44397, // Dissonance
  46044 // Magehunter Strike
]);

// These duplicate-name records are addressed directly by live mechanics.
const WARRIOR_AUTHORABLE_RUNTIME_ALIAS_IDS = new Set<SkillId>([
  30435, // Berserk
  69297, // Breaching Strike
  69433 // Breaching Strike
]);

const allSkills: readonly Skill[] = Object.freeze([
  ...SKILLS.filter((skill) => !/^\(\(/.test(String(skill.name || ''))),
  ...WARRIOR_SUPPLEMENTAL_SKILLS
]);

const canonicalIdByName = new Map<string, SkillId>();

for (const skill of [...allSkills].sort((left, right) => Number(left.id) - Number(right.id))) {
  if (!canonicalIdByName.has(skill.name)) {
    canonicalIdByName.set(skill.name, skill.id);
  }
}

const flipParentById = createFlipParentMap(allSkills);

const generated: readonly Skill[] = Object.freeze(
  allSkills.map((skill) => {
    const { recharge: legacyRecharge, ...sourceSkill } = skill;
    const canonicalId = canonicalIdByName.get(skill.name)!;
    const maximumAmmo = Number(skill.ammo || 0);
    const ammoRecharge = Number(skill.ammoRecharge || 0);

    const cooldown =
      maximumAmmo > 0
        ? Number(ammoRecharge || skill.cooldown || legacyRecharge || 0)
        : Number(skill.cooldown || legacyRecharge || 0);

    const ammoCastLockout = maximumAmmo > 0 ? Number(skill.ammoCastLockout ?? legacyRecharge ?? 0) : 0;

    return {
      ...sourceSkill,
      cooldown,
      ...(ammoCastLockout > 0 ? { ammoCastLockout } : {}),
      flipParentId: flipParentById.get(skill.id) ?? null,
      simulatorAliasOfId: canonicalId === skill.id ? null : canonicalId,
      simulatorExcluded: canonicalId !== skill.id || WARRIOR_SIMULATOR_EXCLUDED_SKILL_IDS.has(Number(skill.id)),
      ...((canonicalId !== skill.id && !WARRIOR_AUTHORABLE_RUNTIME_ALIAS_IDS.has(skill.id)) ||
      WARRIOR_SIMULATOR_EXCLUDED_SKILL_IDS.has(Number(skill.id)) ||
      WARRIOR_UNREACHABLE_PROFESSION_SKILL_IDS.has(skill.id)
        ? {
            patchAuthoringExcluded: true
          }
        : {}),
      implemented: false,
      effects: []
    };
  })
);

const SPECIALIZATION_MECHANICS = Object.freeze({
  Berserker: BERSERKER_SKILL_MECHANICS,
  Spellbreaker: SPELLBREAKER_SKILL_MECHANICS,
  Bladesworn: BLADESWORN_SKILL_MECHANICS,
  Paragon: PARAGON_SKILL_MECHANICS
});

const SPECIALIZATION_ONLY_SKILLS = createSpecializationSkillIds(SPECIALIZATION_MECHANICS);

const SPECIALIZATION_ONLY_SKILL_OWNERS = createSpecializationSkillOwners(SPECIALIZATION_ONLY_SKILLS);

const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh+oh',
  Dagger: 'mh+oh',
  Greatsword: '2h',
  Hammer: '2h',
  Longbow: '2h',
  Mace: 'mh+oh',
  Pistol: 'oh',
  Rifle: '2h',
  Shield: 'oh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh',
  Warhorn: 'oh'
});

interface WarriorModuleDataOptions<TContext extends object> extends ProfessionModuleDataOptions<TContext> {
  readonly autoattackChains?: NativeAutoattackChains;
}

// Normalize generated and supplemental Warrior mechanics into one module with
// shared traits, profiles, handlers, and specialization ownership.
export function createWarriorModuleData<TContext extends object>(
  id: string,
  {
    skillMechanics,
    balanceProfiles = [],
    extraSkills = [],
    handlers,
    autoattackChains
  }: WarriorModuleDataOptions<TContext>
) {
  const normalizedSkillMechanics = Object.freeze(
    Object.fromEntries(
      Object.entries(skillMechanics).map(([skillId, mechanic]) => [
        skillId,
        mechanic.burst && mechanic.skillWeapon && mechanic.skillWeapon !== 'Gunsaber'
          ? {
              ...mechanic,
              requiredMainHand: mechanic.skillWeapon
            }
          : mechanic
      ])
    )
  );

  return createNativeModuleData({
    id,
    generatedSkills: generated,
    skillMechanics: normalizedSkillMechanics,
    balanceProfiles,
    extraSkills,
    handlers,
    traits: TRAITS as readonly CatalogEntity[],
    specializations: SPECIALIZATIONS,
    specializationOnlySkillIds: SPECIALIZATION_ONLY_SKILLS[id] || [],
    specializationOnlySkillOwners: SPECIALIZATION_ONLY_SKILL_OWNERS,
    ...(id === 'Core' ? WEAPON_DATA : {}),
    ...(autoattackChains ? { autoattackChains } : {})
  });
}

export { WARRIOR_CORE_SKILL_MECHANICS };
