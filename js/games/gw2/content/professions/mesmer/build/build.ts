import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { createDefaultTargetConditions } from '#gw2/platform/builds/default-target-conditions.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { mesmerCatalog } from '#gw2/content/professions/mesmer/catalog.js';
import { resolveMesmerSkillIdFromDuplicateName } from '#gw2/content/professions/mesmer/data/duplicate-skill-names.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { MesmerCanonicalBuild } from '#gw2/content/professions/mesmer/types.js';
import { createProfessionBuildCodec } from '#gw2/content/professions/lib/build-codec.js';
import { createCommonBuildDefaults } from '#gw2/content/professions/lib/build-defaults.js';

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
    return {
      ...build,
      rotation: normalizeRotation(disambiguateMesmerRotationSkillNames(saved), mesmerCatalog)
    };
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
