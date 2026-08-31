/**
 * Elementalist build persistence.
 *
 * Owns the profession's saved-build contract: the default build a new session starts
 * from, and the codec that migrates, validates, and adapts stored builds for the
 * application shell. Schema-version bumps and field additions belong here.
 */
import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { createDefaultTargetConditions } from '#gw2/platform/builds/default-target-conditions.js';
import { createCommonBuildDefaults } from '#gw2/content/professions/lib/build-defaults.js';
import { createProfessionBuildCodec } from '#gw2/content/professions/lib/build-codec.js';
import { ELEMENTALIST_ASSUMPTION_CONTROLS } from '#gw2/content/professions/elementalist/app/assumptions.js';
import { elementalistCatalog } from '#gw2/content/professions/elementalist/catalog.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { ElementalistApplicationBuild, ElementalistCanonicalBuild } from '#gw2/content/professions/elementalist/types.js';

/** Bumped whenever the persisted build shape changes, so older saves are migrated on load. */
export const ELEMENTALIST_BUILD_SCHEMA_VERSION = 4;
/** Canonical profession key stamped into saved builds and used for registry lookups. */
export const ELEMENTALIST_PROFESSION_ID = 'elementalist';

const ATTUNEMENT_VALUES = Object.freeze(['Fire', 'Water', 'Air', 'Earth'] as const);

export { createDefaultTargetConditions };

/** The complete starting Elementalist build: gear, traits, skills, and starting resources. */
// Initialize every persisted profession field so migrations can safely overlay
// partial or legacy builds without leaving runtime state undefined.
export function createElementalistBuildDefaults(): ElementalistCanonicalBuild {
  return {
    schemaVersion: ELEMENTALIST_BUILD_SCHEMA_VERSION,
    profession: ELEMENTALIST_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
    weapons: ['Sword', 'Dagger'],
    alternateWeapons: ['', ''],
    rune: 'Scholar',
    weaponSigils: normalizeWeaponSigils(DEFAULT_WEAPON_SIGILS),
    relic: 'Fireworks',
    food: 'Bowl of Sweet and Spicy Butternut Squash Soup',
    utility: 'Superior Sharpening Stone',
    jadeBotCore: true,
    infusions: [
      { stat: 'Power', count: 18 },
      { stat: 'Precision', count: 0 },
      { stat: 'Condition Damage', count: 0 }
    ],
    specializations: [
      { name: 'Fire', traits: '1-3-1' },
      { name: 'Air', traits: '3-3-1' },
      { name: 'Weaver', traits: '1-2-1' }
    ],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    },
    ...createCommonBuildDefaults({
      assumptions: {
        hitboxSize: 'small'
      }
    }),
    startAttunement: 'Fire',
    secondaryAttunement: 'Air',
    initialCatalystEnergy: 30,
    evokerElement: 'Fire',
    initialEvokerCharges: 6,
    initialEvokerEmpowered: 0,
    pistolBullets: {
      Fire: false,
      Water: false,
      Air: false,
      Earth: false
    }
  };
}

// Coerces the saved pistol-bullet toggles into all four element flags, since a partial or
// missing record would otherwise leave the loaded bullets undefined.
function pistolBullets(value: unknown): Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean> {
  const saved = record(value);
  return {
    Fire: Boolean(saved.Fire),
    Water: Boolean(saved.Water),
    Air: Boolean(saved.Air),
    Earth: Boolean(saved.Earth)
  };
}

// One declaration drives migration, validation, and the application build shape: the
// shared codec handles the common fields, and the hooks below cover the Elementalist-only
// fields and the profession's single-weapon-set rule.
const elementalistBuildCodec = createProfessionBuildCodec<ElementalistCanonicalBuild>({
  professionId: ELEMENTALIST_PROFESSION_ID,
  schemaVersion: ELEMENTALIST_BUILD_SCHEMA_VERSION,
  catalog: elementalistCatalog,
  createDefaults: createElementalistBuildDefaults,
  assumptionControls: ELEMENTALIST_ASSUMPTION_CONTROLS,
  // Attunement vocabulary and resource bounds now drive both migration and validation.
  extraFields: {
    startAttunement: {
      type: 'enum',
      values: ATTUNEMENT_VALUES,
      validationMessage: 'startAttunement must be Fire, Water, Air, or Earth.'
    },
    secondaryAttunement: {
      type: 'enum',
      values: ATTUNEMENT_VALUES,
      validationMessage: 'secondaryAttunement must be Fire, Water, Air, or Earth.'
    },
    initialCatalystEnergy: {
      type: 'number',
      minimum: 0,
      maximum: 30
    },
    evokerElement: {
      type: 'enum',
      values: ATTUNEMENT_VALUES,
      validationMessage: 'evokerElement must be Fire, Water, Air, or Earth.'
    },
    initialEvokerCharges: {
      type: 'number',
      minimum: 0,
      maximum: 6
    },
    initialEvokerEmpowered: {
      type: 'number',
      minimum: 0,
      maximum: 3
    }
  },
  // Elementalist has no weapon swap, so a migrated build is pinned to a single set.
  normalizeExtra(build, { saved }) {
    const normalized = {
      ...build,
      alternateWeapons: ['', ''],
      startingWeaponSet: 1,
      pistolBullets: pistolBullets(saved.pistolBullets)
    };
    return normalized;
  },
  // Rejects saves that violate the rules normalizeExtra enforces, so a hand-edited or
  // cross-profession build surfaces an error instead of silently changing behavior.
  validateExtra(build) {
    const errors: string[] = [];
    if (Array.isArray(build.alternateWeapons) && build.alternateWeapons.some(Boolean)) {
      errors.push('Elementalist cannot equip a second weapon set.');
    }

    if (build.startingWeaponSet !== 1) {
      errors.push('Elementalist must start on weapon set 1.');
    }

    if (
      !build.pistolBullets ||
      ['Fire', 'Water', 'Air', 'Earth'].some(
        (element) => typeof build.pistolBullets[element as keyof typeof build.pistolBullets] !== 'boolean'
      )
    ) {
      errors.push('pistolBullets must contain four boolean element states.');
    }

    return errors;
  }
});

// Treats anything that is not a plain object as an empty record.
function record(value: unknown): SchedulerRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SchedulerRecord) : {};
}

/** Upgrades any stored or partial build to the current canonical shape, filling defaults. */
export function migrateElementalistBuild(candidate?: unknown): ElementalistCanonicalBuild {
  return elementalistBuildCodec.migrateBuild(candidate);
}

/** Checks an already-canonical build, reporting `{ valid, errors }` without migrating it. */
export const validateElementalistBuild = elementalistBuildCodec.validateBuild;

/** Migrates and adapts a build into the shape the browser application shell consumes. */
export function toApplicationBuild(candidate: unknown): ElementalistApplicationBuild {
  return elementalistBuildCodec.toApplicationBuild(candidate) as Gw2ApplicationBuild as ElementalistApplicationBuild;
}
