import { GEAR_SLOTS } from '../../platform/gw2/gear-data.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/weapon-sigils.js';
import { createGw2BuildCodec } from '../../platform/gw2/build-codec.js';
import { boundedNumber, enumValue } from '../../platform/gw2/build-normalization.js';
import { createDefaultTargetConditions } from '../../platform/gw2/default-target-conditions.js';
import {
  normalizeSimulationRandomnessAssumptions,
  validateSimulationRandomnessAssumptions
} from '../../app/simulation/randomness.js';
import { createCommonBuildDefaults } from '../lib/build-defaults.js';
import { normalizeProfessionAssumptions, validateProfessionAssumptions } from '../../app/profession/assumptions.js';
import { ELEMENTALIST_ASSUMPTION_CONTROLS } from './assumptions.js';
import { elementalistCatalog } from './catalog.js';
import type { Gw2ApplicationBuild } from '../../platform/gw2/types.js';
import type { SchedulerRecord } from '../../platform/engine/types.js';
import type { ElementalistApplicationBuild, ElementalistCanonicalBuild } from './types.js';

export const ELEMENTALIST_BUILD_SCHEMA_VERSION = 4;
export const ELEMENTALIST_PROFESSION_ID = 'elementalist';

const ATTUNEMENT_VALUES = Object.freeze(['Fire', 'Water', 'Air', 'Earth'] as const);
const ATTUNEMENTS = new Set<string>(ATTUNEMENT_VALUES);
const SNAPSHOT_SELECTED_SKILL_SLOTS = Object.freeze({
  heal: 'Heal',
  util1: 'Utility1',
  util2: 'Utility2',
  util3: 'Utility3',
  elite: 'Elite'
});

export { createDefaultTargetConditions };

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
    delete assumptions.startingAttunementPreDwelled;
    delete assumptions.elementalSimulationProfile;
    delete assumptions.glyphBoonedElementals;
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

function migrateSnapshotSelectedSkills(value: unknown): SchedulerRecord {
  const selectedSkills = record(value);
  return Object.fromEntries(
    Object.entries(selectedSkills).map(([slot, skill]) => [
      SNAPSHOT_SELECTED_SKILL_SLOTS[slot as keyof typeof SNAPSHOT_SELECTED_SKILL_SLOTS] || slot,
      skill
    ])
  );
}

/**
 * Preserves the remaining standalone snapshot fields while requiring
 * simulation assumptions to use the current nested build schema.
 */
function normalizeSavedBuild(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return candidate;
  }

  const snapshot = candidate as SchedulerRecord;
  const hasSnapshotWrapper =
    snapshot.build && typeof snapshot.build === 'object' && !Array.isArray(snapshot.build) && !snapshot.profession;
  const build = hasSnapshotWrapper ? record(snapshot.build) : snapshot;
  const snapshotFields = hasSnapshotWrapper ? snapshot : build;
  const selectedSkills = Object.hasOwn(snapshotFields, 'selectedSkills')
    ? migrateSnapshotSelectedSkills(snapshotFields.selectedSkills)
    : build.selectedSkills;

  return {
    ...build,
    ...(selectedSkills ? { selectedSkills } : {}),
    ...(Array.isArray(snapshotFields.rotation) ? { rotation: snapshotFields.rotation } : {}),
    ...(snapshotFields.activeAttunement ? { startAttunement: snapshotFields.activeAttunement } : {}),
    ...(snapshotFields.secondaryAttunement ? { secondaryAttunement: snapshotFields.secondaryAttunement } : {}),
    ...(Object.hasOwn(snapshotFields, 'evokerElement') ? { evokerElement: snapshotFields.evokerElement } : {}),
    ...(Object.hasOwn(snapshotFields, 'evokerStartCharges')
      ? { initialEvokerCharges: snapshotFields.evokerStartCharges }
      : {}),
    ...(Object.hasOwn(snapshotFields, 'evokerStartEmpowered')
      ? { initialEvokerEmpowered: snapshotFields.evokerStartEmpowered }
      : {}),
    ...(Object.hasOwn(snapshotFields, 'pistolBullets') ? { pistolBullets: snapshotFields.pistolBullets } : {}),
    assumptions: {
      ...record(build.assumptions),
      ...(Object.hasOwn(snapshotFields, 'hitboxSize') ? { hitboxSize: snapshotFields.hitboxSize } : {})
    }
  };
}

export function migrateElementalistBuild(candidate?: unknown): ElementalistCanonicalBuild {
  return elementalistBuildCodec.migrateBuild(normalizeSavedBuild(candidate));
}

export const validateElementalistBuild = elementalistBuildCodec.validateBuild;

export function toApplicationBuild(candidate: unknown): ElementalistApplicationBuild {
  return elementalistBuildCodec.toApplicationBuild(
    normalizeSavedBuild(candidate)
  ) as Gw2ApplicationBuild as ElementalistApplicationBuild;
}
