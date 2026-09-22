import {
  createFlipParentMap,
  createProfessionModuleDataFactory,
  defineProfessionWeapons,
  normalizeGeneratedSkill
} from '#gw2/professions/shared/catalog-data.js';
import type { ProfessionModuleDataOptions } from '#gw2/professions/shared/catalog-data.js';
import { SKILLS, SPECIALIZATIONS } from '#gw2/professions/warrior/data/warrior-api-metadata.js';
import { WARRIOR_SUPPLEMENTAL_SKILLS } from '#gw2/professions/warrior/data/warrior-supplemental-skills.js';
import { TRAITS } from '#gw2/professions/warrior/data/traits-data.js';
import type { CatalogEntity, Skill } from '#gw2/platform/engine/skills/types.js';
import type { AutoattackChainOptions } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';

const allSkills: readonly Skill[] = Object.freeze([
  ...SKILLS.filter((skill) => !/^\(\(/.test(String(skill.name || ''))),
  ...WARRIOR_SUPPLEMENTAL_SKILLS
]);

// Explicit winners preserve canonical name-based rotations when reviewed variants share a name.
export const WARRIOR_NATIVE_CATALOG_OPTIONS = Object.freeze({
  skillNameOverrides: Object.freeze({
    'Path to Victory': 71932,
    "Harrier's Toss": 73024
  })
});

const flipParentById = createFlipParentMap(allSkills);

const generated: readonly Skill[] = Object.freeze(
  allSkills.map((skill) => {
    // Select recharge before stripping the legacy field, which independently supplies ammo cast lockout.
    const { recharge: legacyRecharge, ...sourceSkill } = normalizeGeneratedSkill(
      skill,
      flipParentById.get(skill.id) ?? null
    );
    const maximumAmmo = Number(skill.ammo || 0);
    const ammoCastLockout = maximumAmmo > 0 ? Number(skill.ammoCastLockout ?? legacyRecharge ?? 0) : 0;

    return {
      ...sourceSkill,
      ...(ammoCastLockout > 0 ? { ammoCastLockout } : {})
    };
  })
);

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

interface WarriorModuleDataOptions extends ProfessionModuleDataOptions {
  readonly autoattackChains?: AutoattackChainOptions;
}

const createModuleData = createProfessionModuleDataFactory({
  generatedSkills: generated,
  traits: TRAITS as readonly CatalogEntity[],
  specializations: SPECIALIZATIONS,
  core: { ...WEAPON_DATA, skillNameOverrides: WARRIOR_NATIVE_CATALOG_OPTIONS.skillNameOverrides }
});

// Normalize generated and supplemental Warrior mechanics into one module with
// shared traits, profiles, and specialization ownership.
export function createWarriorModuleData(id: string, { skillMechanics, ...options }: WarriorModuleDataOptions) {
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

  return createModuleData(id, {
    ...options,
    skillMechanics: normalizedSkillMechanics,
    // Every skill a specialization module declares mechanics for is exclusive to that specialization.
    specializationOnlySkillIds: id === 'Core' ? [] : Object.keys(skillMechanics).map(Number)
  });
}
