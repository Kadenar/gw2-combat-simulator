import { GEAR_SLOTS } from '../../platform/gw2/gear-data.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/weapon-sigils.js';
import { createGw2BuildCodec } from '../../platform/gw2/build-codec.js';
import { createDefaultTargetConditions } from '../../platform/gw2/default-target-conditions.js';
import {
  DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS,
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
    assumptions: {
      ...DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS,
      hitboxSize: 'small',
      might: 25,
      fury: true,
      quickness: true,
      alacrity: true,
      protection: true,
      resolution: true,
      regeneration: true,
      swiftness: true,
      vigor: true,
      aegis: false,
      targetMoving: false,
      targetBoonless: true,
      targetConditions: createDefaultTargetConditions()
    },
    initialEnergy: 50,
    startingWeaponSet: 1,
    targetHealth: 3_970_000,
    targetArmor: 2597,
    rotation: []
  };
}

const revenantBuildCodec = createGw2BuildCodec<RevenantCanonicalBuild>({
  professionId: REVENANT_PROFESSION_ID,
  schemaVersion: REVENANT_BUILD_SCHEMA_VERSION,
  catalog: revenantCatalog,
  createDefaults: createRevenantBuildDefaults,
  slotLoadout: revenantLegendLoadout as unknown as Gw2SlotLoadout<RevenantCanonicalBuild>,
  normalizeExtra(build, { saved }) {
    const selectedDodge = String(saved.selectedDodge || '');
    return {
      ...build,
      assumptions: normalizeProfessionAssumptions(
        normalizeSimulationRandomnessAssumptions(build.assumptions),
        REVENANT_ASSUMPTION_CONTROLS
      ),
      initialEnergy: Math.max(0, Math.min(100, Number(saved.initialEnergy ?? 50) || 0)),
      selectedDodge: ['Death Drop', 'Saint of zu Heltzer', 'Imperial Impact'].includes(selectedDodge)
        ? (selectedDodge as RevenantDodge)
        : 'Death Drop',
      allianceSide: saved.allianceSide === 'kurzick' ? 'kurzick' : 'luxon'
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
