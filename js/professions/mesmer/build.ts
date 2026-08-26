import { GEAR_SLOTS } from '../../platform/gw2/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/equipment/sigils/loadout.js';
import { createGw2BuildCodec } from '../../platform/gw2/builds/codec.js';
import { boundedNumber } from '../../platform/gw2/builds/normalization.js';
import { createDefaultTargetConditions } from '../../platform/gw2/builds/default-target-conditions.js';
import { normalizeRotation } from '../../platform/engine/execution/rotation.js';
import {
  normalizeSimulationRandomnessAssumptions,
  validateSimulationRandomnessAssumptions
} from '../../app/simulation/randomness.js';
import { mesmerCatalog } from './catalog.js';
import { resolveMesmerSkillIdFromDuplicateName } from './data/duplicate-skill-names.js';
import type { SchedulerRecord } from '../../platform/engine/types.js';
import type { MesmerCanonicalBuild } from './types.js';
import { createCommonBuildDefaults } from '../lib/build-defaults.js';

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
export const PROFESSION_ID = 'mesmer';

export { createDefaultTargetConditions };

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
      { stat: 'Precision', count: 0 },
      { stat: 'Condition Damage', count: 0 }
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

function plainObject(value: unknown): SchedulerRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SchedulerRecord) : {};
}

const mesmerBuildCodec = createGw2BuildCodec({
  professionId: PROFESSION_ID,
  schemaVersion: BUILD_SCHEMA_VERSION,
  catalog: mesmerCatalog,
  createDefaults: createMesmerBuildDefaults,
  normalizeExtra(build, { saved }) {
    return {
      ...build,
      assumptions: normalizeSimulationRandomnessAssumptions(build.assumptions),
      rotation: normalizeRotation(disambiguateMesmerRotationSkillNames(saved), mesmerCatalog),
      initialResource: boundedNumber(saved.initialResource ?? 5, 0, 0, 5)
    };
  },
  validateExtra(build) {
    const errors = validateSimulationRandomnessAssumptions(build.assumptions);
    if (!(Number(build.initialResource) >= 0 && Number(build.initialResource) <= 5)) {
      errors.push('initialResource must be between 0 and 5.');
    }

    return errors;
  }
});

function configuredSpecialization(candidate: unknown = {}): string {
  const saved = plainObject(candidate);
  if (saved.specialization) return String(saved.specialization);
  const eliteNames = new Set(
    mesmerCatalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name)
  );
  return (
    (Array.isArray(saved.specializations) ? saved.specializations : [])
      .flatMap((selection) => {
        const name = plainObject(selection).name;
        return name == null ? [] : [String(name)];
      })
      .find((name) => eliteNames.has(name)) || 'Core'
  );
}

/**
 * Uses the selected specialization to disambiguate only duplicated names.
 * Stable-ID entries and unique names pass through to shared normalization.
 */
function disambiguateMesmerRotationSkillNames(candidate: unknown = {}): unknown[] {
  const saved = plainObject(candidate);
  const specialization = configuredSpecialization(saved);
  const rotation = Array.isArray(saved.rotation) ? saved.rotation : [];
  return rotation.map((entry: unknown) => {
    if (typeof entry === 'string') {
      const resolved = resolveMesmerSkillIdFromDuplicateName(entry, { specialization });
      return resolved === undefined
        ? entry
        : resolved == null
          ? { type: 'cast', skillId: entry }
          : { type: 'cast', skillId: resolved };
    }

    const record = plainObject(entry);
    if (!entry || typeof entry !== 'object' || record.skillId != null || record.id != null) {
      return entry;
    }

    const resolved = resolveMesmerSkillIdFromDuplicateName(String(record.name || ''), {
      specialization
    });
    if (resolved === undefined) return entry;
    return {
      ...record,
      skillId: resolved ?? record.name
    };
  });
}

export const migrateMesmerBuild = mesmerBuildCodec.migrateBuild;
export const validateMesmerBuild = mesmerBuildCodec.validateBuild;
export const toApplicationBuild = mesmerBuildCodec.toApplicationBuild;
