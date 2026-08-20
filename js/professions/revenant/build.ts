import { GEAR_SLOTS } from '../../platform/gw2/gear-data.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/weapon-sigils.js';
import { createGw2BuildCodec } from '../../platform/gw2/build-codec.js';
import { boundedNumber, enumValue } from '../../platform/gw2/build-normalization.js';
import { createDefaultTargetConditions } from '../../platform/gw2/default-target-conditions.js';
import {
  normalizeSimulationRandomnessAssumptions,
  validateSimulationRandomnessAssumptions
} from '../../app/simulation/randomness.js';
import { normalizeProfessionAssumptions, validateProfessionAssumptions } from '../../app/profession/assumptions.js';
import { REVENANT_ASSUMPTION_CONTROLS } from './assumptions.js';
import { revenantCatalog } from './catalog.js';
import { REVENANT_LEGEND_IDS as LEGEND } from './data/ids.js';
import { revenantLegendLoadout } from './legend-loadout.js';
import type { RevenantCanonicalBuild, RevenantDodge } from './types.js';
import type { Gw2SlotLoadout } from '../../platform/gw2/types.js';
import { createCommonBuildDefaults } from '../lib/build-defaults.js';

/**
 * Revenant persisted-build definition.
 *
 * This module supplies Revenant defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * It delegates slot-skill structure to the legend loadout and constrains
 * starting Energy, Vindicator dodge choice, and Alliance starting side.
 */

export const REVENANT_BUILD_SCHEMA_VERSION = 3;
export const REVENANT_PROFESSION_ID = 'revenant';
const REVENANT_DODGES = Object.freeze(['Death Drop', 'Saint of zu Heltzer', 'Imperial Impact'] as const);

export { createDefaultTargetConditions };

export function createRevenantBuildDefaults(): RevenantCanonicalBuild {
  return {
    schemaVersion: REVENANT_BUILD_SCHEMA_VERSION,
    profession: REVENANT_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Viper's"])),
    alternateWeaponPrefixes: ["Viper's", "Viper's"],
    weapons: ['Sword', 'Sword'],
    alternateWeapons: ['Mace', 'Axe'],
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
      { name: 'Corruption', traits: '1-3-3' },
      { name: 'Invocation', traits: '2-2-3' },
      { name: 'Herald', traits: '1-1-1' }
    ],
    selectedSkills: {},
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
    startingLegend: LEGEND.ASSASSIN,
    selectedDodge: 'Death Drop',
    allianceSide: 'luxon',
    ...createCommonBuildDefaults({
      assumptions: {
        hitboxSize: 'small'
      }
    }),
    initialEnergy: 50
  };
}

const revenantBuildCodec = createGw2BuildCodec<RevenantCanonicalBuild>({
  professionId: REVENANT_PROFESSION_ID,
  schemaVersion: REVENANT_BUILD_SCHEMA_VERSION,
  catalog: revenantCatalog,
  createDefaults: createRevenantBuildDefaults,
  slotLoadout: revenantLegendLoadout as unknown as Gw2SlotLoadout<RevenantCanonicalBuild>,
  normalizeExtra(build, { saved }) {
    return {
      ...build,
      assumptions: normalizeProfessionAssumptions(
        normalizeSimulationRandomnessAssumptions(build.assumptions),
        REVENANT_ASSUMPTION_CONTROLS
      ),
      initialEnergy: boundedNumber(saved.initialEnergy ?? 50, 0, 0, 100),
      selectedDodge: enumValue(String(saved.selectedDodge || ''), REVENANT_DODGES, 'Death Drop') as RevenantDodge,
      allianceSide: enumValue(saved.allianceSide, ['luxon', 'kurzick'], 'luxon')
    };
  },
  validateExtra(build) {
    const errors = validateSimulationRandomnessAssumptions(build.assumptions);
    errors.push(...validateProfessionAssumptions(build.assumptions, REVENANT_ASSUMPTION_CONTROLS));
    if (!(Number(build.initialEnergy) >= 0 && Number(build.initialEnergy) <= 100)) {
      errors.push('initialEnergy must be between 0 and 100.');
    }

    if (!['luxon', 'kurzick'].includes(build.allianceSide)) {
      errors.push('allianceSide must be luxon or kurzick.');
    }

    return errors;
  }
});

export const migrateRevenantBuild = revenantBuildCodec.migrateBuild;
export const validateRevenantBuild = revenantBuildCodec.validateBuild;
export const toApplicationBuild = revenantBuildCodec.toApplicationBuild;
