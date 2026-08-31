import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { createDefaultTargetConditions } from '#gw2/platform/builds/default-target-conditions.js';
import { necromancerCatalog } from '#gw2/content/professions/necromancer/catalog.js';
import type { NecromancerCanonicalBuild } from '#gw2/content/professions/necromancer/types.js';
import { createProfessionBuildCodec } from '#gw2/content/professions/lib/build-codec.js';
import { createCommonBuildDefaults } from '#gw2/content/professions/lib/build-defaults.js';

/**
 * Necromancer persisted-build definition.
 *
 * This module supplies Necromancer defaults and configures the shared GW2
 * build codec for migration, normalization, validation, and app-facing
 * conversion. Its profession-specific rules constrain starting life force and
 * Harbinger blight.
 */

export const NECROMANCER_BUILD_SCHEMA_VERSION = 3;
export const NECROMANCER_PROFESSION_ID = 'necromancer';

/** Re-exports the shared default target-condition factory through the Necromancer build contract. */
export { createDefaultTargetConditions };

/** Creates the schema-current Necromancer preset used for new builds and migration fallbacks. */
export function createNecromancerBuildDefaults(): NecromancerCanonicalBuild {
  return {
    schemaVersion: NECROMANCER_BUILD_SCHEMA_VERSION,
    profession: NECROMANCER_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Viper's"])),
    alternateWeaponPrefixes: ["Viper's", "Viper's"],
    weapons: ['Scepter', 'Dagger'],
    alternateWeapons: ['Pistol', 'Torch'],
    rune: 'Trapper',
    weaponSigils: normalizeWeaponSigils(DEFAULT_WEAPON_SIGILS),
    relic: 'Fractal',
    food: 'Plate of Beef Rendang',
    utility: 'Toxic Tuning Crystal',
    jadeBotCore: true,
    infusions: [
      { stat: 'Power', count: 0 },
      { stat: 'Precision', count: 0 },
      { stat: 'Condition Damage', count: 18 }
    ],
    specializations: [
      { name: 'Curses', traits: '1-3-3' },
      { name: 'Soul Reaping', traits: '1-1-3' },
      { name: 'Harbinger', traits: '1-3-3' }
    ],
    selectedSkills: {
      Heal: 'Elixir of Promise',
      Utility1: 'Blood Is Power',
      Utility2: 'Elixir of Anguish',
      Utility3: 'Elixir of Risk',
      Elite: 'Elixir of Ambition'
    },
    ...createCommonBuildDefaults({
      assumptions: {
        permanentIceField: false,
        targetSkillActivationsPerSecond: 0
      }
    }),
    initialResource: 100,
    initialBlight: 0,
    initialCascadingCorruptionStacks: 0
  };
}

const necromancerBuildCodec = createProfessionBuildCodec<NecromancerCanonicalBuild>({
  professionId: NECROMANCER_PROFESSION_ID,
  schemaVersion: NECROMANCER_BUILD_SCHEMA_VERSION,
  catalog: necromancerCatalog,
  createDefaults: createNecromancerBuildDefaults,
  // Life force stays continuous; stack-like Harbinger resources are integers.
  extraFields: {
    initialResource: {
      type: 'number',
      minimum: 0,
      maximum: 100
    },
    initialBlight: {
      type: 'integer',
      minimum: 0,
      maximum: 25
    },
    initialCascadingCorruptionStacks: {
      type: 'integer',
      minimum: 0,
      maximum: 19
    }
  }
});

/** Migrates persisted Necromancer builds to the current canonical schema. */
export const migrateNecromancerBuild = necromancerBuildCodec.migrateBuild;
/** Validates a Necromancer build against the canonical schema and resource constraints. */
export const validateNecromancerBuild = necromancerBuildCodec.validateBuild;
/** Converts a canonical Necromancer build into the shape consumed by the application runtime. */
export const toApplicationBuild = necromancerBuildCodec.toApplicationBuild;
