import { normalizeWeaponSigils } from '../../../../platform/equipment/sigils/loadout.js';
import { createDefaultTargetConditions } from '../../../../platform/builds/default-target-conditions.js';
import { guardianCatalog } from '../catalog.js';
import type { GuardianCanonicalBuild } from '../types.js';
import { createProfessionBuildCodec } from '../../lib/build-codec.js';
import { createCommonBuildDefaults } from '../../lib/build-defaults.js';

/**
 * Guardian persisted-build definition.
 *
 * This module supplies Guardian defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * Its profession-specific rule normalizes and validates the initial number of
 * Firebrand tome pages.
 */

export const GUARDIAN_BUILD_SCHEMA_VERSION = 3;
export const GUARDIAN_PROFESSION_ID = 'guardian';

export { createDefaultTargetConditions };

/** @returns {GuardianCanonicalBuild} */
export function createGuardianBuildDefaults(): GuardianCanonicalBuild {
  return {
    schemaVersion: GUARDIAN_BUILD_SCHEMA_VERSION,
    profession: GUARDIAN_PROFESSION_ID,
    gear: {
      Helm: "Berserker's",
      Shoulders: "Berserker's",
      Chest: "Dragon's",
      Gloves: "Berserker's",
      Leggins: "Dragon's",
      Boots: "Berserker's",
      Amulet: "Dragon's",
      Ring1: "Dragon's",
      Ring2: "Dragon's",
      Accessory1: "Berserker's",
      Accessory2: "Berserker's",
      Back: "Dragon's",
      Weapon1: "Berserker's",
      Weapon2: "Berserker's"
    },
    alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
    weapons: ['Spear', ''],
    alternateWeapons: ['Greatsword', ''],
    rune: 'Dragonhunter',
    weaponSigils: normalizeWeaponSigils([
      ['Force', 'Impact'],
      ['Force', 'Impact']
    ]),
    relic: 'Dragonhunter',
    food: 'Cilantro Lime Sous-Vide Steak',
    utility: 'Superior Sharpening Stone',
    jadeBotCore: true,
    infusions: [
      { stat: 'Power', count: 18 },
      { stat: 'Precision', count: 0 },
      { stat: 'Condition Damage', count: 0 }
    ],
    specializations: [
      { name: 'Radiance', traits: '3-3-3' },
      { name: 'Zeal', traits: '2-2-3' },
      { name: 'Dragonhunter', traits: '1-2-3' }
    ],
    selectedSkills: {
      Heal: 'Purification',
      Utility1: 'Procession of Blades',
      Utility2: 'Sword of Justice',
      Utility3: 'Bane Signet',
      Elite: "Dragon's Maw"
    },
    ...createCommonBuildDefaults({
      assumptions: {
        targetSkillActivationsPerSecond: 0
      }
    }),
    initialTomePages: 5
  };
}

const guardianBuildCodec = createProfessionBuildCodec<GuardianCanonicalBuild>({
  professionId: GUARDIAN_PROFESSION_ID,
  schemaVersion: GUARDIAN_BUILD_SCHEMA_VERSION,
  catalog: guardianCatalog,
  createDefaults: createGuardianBuildDefaults,
  // Tome pages are integer-valued; migration truncates before applying bounds.
  extraFields: {
    initialTomePages: {
      type: 'integer',
      minimum: 0,
      maximum: 8
    }
  },
  normalizeExtra(build) {
    const { initialResource: _discardedInitialResource, ...current } = build;
    return current as GuardianCanonicalBuild;
  }
});

export const migrateGuardianBuild = guardianBuildCodec.migrateBuild;
export const validateGuardianBuild = guardianBuildCodec.validateBuild;
export const toApplicationBuild = guardianBuildCodec.toApplicationBuild;
