import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/slots.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { mesmerCatalog, mesmerNativeModules } from '#gw2/professions/mesmer/catalog.js';
import { MESMER_NATIVE_CATALOG_OPTIONS } from '#gw2/professions/mesmer/data/module-data.js';
import {
  assembleNativeRuntimeCatalog,
  getNativeCatalogAssembly
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import type { MesmerCanonicalBuild } from '#gw2/professions/mesmer/types.js';
import { createProfessionBuildCodec } from '#gw2/professions/shared/build-codec.js';
import { createCommonBuildDefaults } from '#gw2/professions/shared/build-defaults.js';

/**
 * Mesmer persisted-build definition.
 *
 * This module supplies Mesmer defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * The shared codec handles common persisted fields while this module
 * normalizes simulation randomness, rotation aliases, and the initial clone,
 * blade, or note resource.
 */

export const BUILD_SCHEMA_VERSION = 3;
const PROFESSION_ID = 'mesmer';

// Seed a schema-current Mesmer preset with complete equipment, assumptions,
// specialization, weapon, and rotation fields for migration and UI consumers.
export function createMesmerBuildDefaults(): MesmerCanonicalBuild {
  return {
    schemaVersion: BUILD_SCHEMA_VERSION,
    profession: PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
    weapons: ['Dagger', 'Sword'],
    alternateWeapons: ['Spear', ''],
    rune: 'Scholar',
    weaponSigils: normalizeWeaponSigils(DEFAULT_WEAPON_SIGILS),
    relic: 'Thief',
    food: 'Bowl of Sweet and Spicy Butternut Squash Soup',
    utility: 'Superior Sharpening Stone',
    jadeBotCore: true,
    infusions: [
      { stat: 'Power', count: 18 },
      { stat: 'Precision', count: 0 }
    ],
    specializations: [
      { name: 'Dueling', traits: '1-3-1' },
      { name: 'Illusions', traits: '1-2-1' },
      { name: 'Virtuoso', traits: '3-3-3' }
    ],
    selectedSkills: {
      Heal: 'Twin Blade Restoration',
      Utility1: 'Signet of Domination',
      Utility2: 'Mantra of Pain',
      Utility3: 'Rain of Swords',
      Elite: 'Thousand Cuts'
    },
    ...createCommonBuildDefaults({
      assumptions: {
        targetSkillActivationsPerSecond: 0
      }
    }),
    initialResource: 5
  };
}

const mesmerBuildCodec = createProfessionBuildCodec<MesmerCanonicalBuild>({
  professionId: PROFESSION_ID,
  schemaVersion: BUILD_SCHEMA_VERSION,
  catalog: mesmerCatalog,
  createDefaults: createMesmerBuildDefaults,
  // Clone, blade, and note resources share one persisted numeric range.
  extraFields: {
    initialResource: {
      type: 'number',
      minimum: 0,
      maximum: 5
    }
  },
  normalizeExtra(build, { saved }) {
    // Load names through the same Core + elite catalog used by simulation, preserving explicit IDs.
    const specialization =
      saved.specialization ||
      build.specializations.find(({ name }) =>
        mesmerCatalog.specializations.some((entry) => entry.elite && entry.name === name)
      )?.name ||
      'Core';
    const { fragments } = getNativeCatalogAssembly(mesmerNativeModules, MESMER_NATIVE_CATALOG_OPTIONS);
    const catalog = assembleNativeRuntimeCatalog(
      mesmerNativeModules
        .filter((module) => module.id === 'Core' || module.id === specialization)
        .map((module) => fragments.get(module.id)!)
    );
    return {
      ...build,
      rotation: normalizeRotation(saved.rotation, catalog)
    };
  }
});

export const migrateMesmerBuild = mesmerBuildCodec.migrateBuild;
export const validateMesmerBuild = mesmerBuildCodec.validateBuild;
export const toApplicationBuild = mesmerBuildCodec.toApplicationBuild;
