import { MESMER_SKILL_IDS as SKILL } from '#gw2/professions/mesmer/data/ids.js';
import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/slots.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { getMesmerBuildRotationLookup, mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import type { MesmerCanonicalBuild } from '#gw2/professions/mesmer/types.js';
import { createProfessionBuildCodec } from '#gw2/professions/shared/build-codec.js';
import { createCommonBuildDefaults } from '#gw2/professions/shared/build-defaults.js';

/**
 * Mesmer persisted-build definition.
 *
 * This module supplies Mesmer defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * The shared codec handles common persisted fields while this module
 * normalizes simulation randomness, resolves rotation names against the
 * selected specialization, and bounds the initial clone, blade, or note resource.
 */

export const BUILD_SCHEMA_VERSION = 4;
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
    selectedSkillIds: {
      Heal: SKILL.TWIN_BLADE_RESTORATION,
      Utility1: SKILL.SIGNET_OF_DOMINATION,
      Utility2: SKILL.MANTRA_OF_PAIN,
      Utility3: SKILL.RAIN_OF_SWORDS,
      Elite: SKILL.THOUSAND_CUTS
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
    // Re-read the saved rotation: the common pass resolved names against the full catalog, whose shared names pick
    // non-elite variants such as Bladecall, and a converted command no longer records its authored name. Resolve
    // names with Core plus the selected elite instead; explicit IDs keep precedence over names.
    const specialization =
      saved.specialization ||
      build.specializations.find(({ name }) =>
        mesmerCatalog.specializations.some((entry) => entry.elite && entry.name === name)
      )?.name ||
      'Core';
    return {
      ...build,
      rotation: normalizeRotation(saved.rotation, getMesmerBuildRotationLookup(specialization))
    };
  }
});

export const migrateMesmerBuild = mesmerBuildCodec.migrateBuild;
export const validateMesmerBuild = mesmerBuildCodec.validateBuild;
export const toApplicationBuild = mesmerBuildCodec.toApplicationBuild;
