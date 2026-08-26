import { GEAR_SLOTS } from '../../platform/gw2/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/equipment/sigils/loadout.js';
import { createGw2BuildCodec } from '../../platform/gw2/builds/codec.js';
import { boundedNumber, enumValue } from '../../platform/gw2/builds/normalization.js';
import { createDefaultTargetConditions } from '../../platform/gw2/builds/default-target-conditions.js';
import {
  normalizeSimulationRandomnessAssumptions,
  validateSimulationRandomnessAssumptions
} from '../../app/simulation/randomness.js';
import { createCommonBuildDefaults } from '../lib/build-defaults.js';
import { normalizeProfessionAssumptions, validateProfessionAssumptions } from '../../app/profession/assumptions.js';
import { ELEMENTALIST_ASSUMPTION_CONTROLS } from './assumptions.js';
import { elementalistCatalog } from './catalog.js';
import type { Gw2ApplicationBuild } from '../../platform/gw2/builds/types.js';
import type { SchedulerRecord } from '../../platform/engine/types.js';
import type { ElementalistApplicationBuild, ElementalistCanonicalBuild } from './types.js';

export const ELEMENTALIST_BUILD_SCHEMA_VERSION = 4;
export const ELEMENTALIST_PROFESSION_ID = 'elementalist';

const ATTUNEMENT_VALUES = Object.freeze(['Fire', 'Water', 'Air', 'Earth'] as const);
const ATTUNEMENTS = new Set<string>(ATTUNEMENT_VALUES);

export { createDefaultTargetConditions };

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

function attunement(value: unknown, fallback: string): string {
  return enumValue(String(value), ATTUNEMENT_VALUES, fallback as (typeof ATTUNEMENT_VALUES)[number]);
}

function pistolBullets(value: unknown): Record<'Fire' | 'Water' | 'Air' | 'Earth', boolean> {
  const saved = record(value);
  return {
    Fire: Boolean(saved.Fire),
    Water: Boolean(saved.Water),
    Air: Boolean(saved.Air),
    Earth: Boolean(saved.Earth)
  };
}

const elementalistBuildCodec = createGw2BuildCodec<ElementalistCanonicalBuild>({
  professionId: ELEMENTALIST_PROFESSION_ID,
  schemaVersion: ELEMENTALIST_BUILD_SCHEMA_VERSION,
  catalog: elementalistCatalog,
  createDefaults: createElementalistBuildDefaults,
  normalizeExtra(build, { saved }) {
    const assumptions = normalizeProfessionAssumptions(
      normalizeSimulationRandomnessAssumptions(build.assumptions),
      ELEMENTALIST_ASSUMPTION_CONTROLS
    );
    const normalized = {
      ...build,
      alternateWeapons: ['', ''],
      startingWeaponSet: 1,
      assumptions,
      startAttunement: attunement(saved.startAttunement, 'Fire'),
      secondaryAttunement: attunement(saved.secondaryAttunement, 'Air'),
      initialCatalystEnergy: boundedNumber(saved.initialCatalystEnergy ?? 30, 0, 0, 30),
      evokerElement: attunement(saved.evokerElement, 'Fire'),
      initialEvokerCharges: boundedNumber(saved.initialEvokerCharges ?? 6, 0, 0, 6),
      initialEvokerEmpowered: boundedNumber(saved.initialEvokerEmpowered ?? 0, 0, 0, 3),
      pistolBullets: pistolBullets(saved.pistolBullets)
    };
    return normalized;
  },
  validateExtra(build) {
    const errors = validateSimulationRandomnessAssumptions(build.assumptions);
    errors.push(...validateProfessionAssumptions(build.assumptions, ELEMENTALIST_ASSUMPTION_CONTROLS));
    if (Array.isArray(build.alternateWeapons) && build.alternateWeapons.some(Boolean)) {
      errors.push('Elementalist cannot equip a second weapon set.');
    }

    if (build.startingWeaponSet !== 1) {
      errors.push('Elementalist must start on weapon set 1.');
    }

    if (!ATTUNEMENTS.has(build.startAttunement)) {
      errors.push('startAttunement must be Fire, Water, Air, or Earth.');
    }

    if (!ATTUNEMENTS.has(build.secondaryAttunement)) {
      errors.push('secondaryAttunement must be Fire, Water, Air, or Earth.');
    }

    if (!(build.initialCatalystEnergy >= 0 && build.initialCatalystEnergy <= 30)) {
      errors.push('initialCatalystEnergy must be between 0 and 30.');
    }

    if (!(build.initialEvokerCharges >= 0 && build.initialEvokerCharges <= 6)) {
      errors.push('initialEvokerCharges must be between 0 and 6.');
    }

    if (!(build.initialEvokerEmpowered >= 0 && build.initialEvokerEmpowered <= 3)) {
      errors.push('initialEvokerEmpowered must be between 0 and 3.');
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

function record(value: unknown): SchedulerRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SchedulerRecord) : {};
}

export function migrateElementalistBuild(candidate?: unknown): ElementalistCanonicalBuild {
  return elementalistBuildCodec.migrateBuild(candidate);
}

export const validateElementalistBuild = elementalistBuildCodec.validateBuild;

export function toApplicationBuild(candidate: unknown): ElementalistApplicationBuild {
  return elementalistBuildCodec.toApplicationBuild(candidate) as Gw2ApplicationBuild as ElementalistApplicationBuild;
}
