import { GEAR_SLOTS } from '../../platform/gw2/gear-data.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/weapon-sigils.js';
import { createGw2BuildCodec } from '../../platform/gw2/build-codec.js';
import { createDefaultTargetConditions } from '../../platform/gw2/default-target-conditions.js';
import {
  normalizeSimulationRandomnessAssumptions,
  validateSimulationRandomnessAssumptions
} from '../../app/simulation/randomness.js';
import { necromancerCatalog } from './catalog.js';
import type { NecromancerCanonicalBuild } from './types.js';
import { createCommonBuildDefaults } from '../lib/build-defaults.js';

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

export { createDefaultTargetConditions };

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

const necromancerBuildCodec = createGw2BuildCodec<NecromancerCanonicalBuild>({
  professionId: NECROMANCER_PROFESSION_ID,
  schemaVersion: NECROMANCER_BUILD_SCHEMA_VERSION,
  catalog: necromancerCatalog,
  createDefaults: createNecromancerBuildDefaults,
  normalizeExtra(build, { saved }) {
    return {
      ...build,
      assumptions: normalizeSimulationRandomnessAssumptions(build.assumptions),
      initialResource: Math.max(0, Math.min(100, Number(saved.initialResource ?? 100) || 0)),
      initialBlight: Math.max(0, Math.min(25, Math.trunc(Number(saved.initialBlight || 0)))),
      initialCascadingCorruptionStacks: Math.max(
        0,
        Math.min(19, Math.trunc(Number(saved.initialCascadingCorruptionStacks || 0)))
      )
    };
  },
  validateExtra(build) {
    const errors = validateSimulationRandomnessAssumptions(build.assumptions);
    if (!(Number(build.initialResource) >= 0 && Number(build.initialResource) <= 100)) {
      errors.push('initialResource must be between 0 and 100.');
    }

    if (!(Number(build.initialBlight) >= 0 && Number(build.initialBlight) <= 25)) {
      errors.push('initialBlight must be between 0 and 25.');
    }

    if (
      !(Number(build.initialCascadingCorruptionStacks) >= 0 && Number(build.initialCascadingCorruptionStacks) <= 19)
    ) {
      errors.push('initialCascadingCorruptionStacks must be between 0 and 19.');
    }

    return errors;
  }
});

export const migrateNecromancerBuild = necromancerBuildCodec.migrateBuild;
export const validateNecromancerBuild = necromancerBuildCodec.validateBuild;
export const toApplicationBuild = necromancerBuildCodec.toApplicationBuild;
