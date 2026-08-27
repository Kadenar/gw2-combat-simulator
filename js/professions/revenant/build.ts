import { GEAR_SLOTS } from '../../platform/gw2/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/equipment/sigils/loadout.js';
import { createDefaultTargetConditions } from '../../platform/gw2/builds/default-target-conditions.js';
import { createProfessionBuildCodec } from '../lib/build-codec.js';
import { REVENANT_ASSUMPTION_CONTROLS } from './assumptions.js';
import { revenantCatalog } from './catalog.js';
import { REVENANT_LEGEND_IDS as LEGEND } from './data/ids.js';
import { revenantLegendLoadout } from './legend-loadout.js';
import type { RevenantCanonicalBuild } from './types.js';
import type { Gw2SlotLoadout } from '../../platform/gw2/builds/types.js';
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

// Seed a schema-current Revenant preset with a legal legend pair, complete
// resources, assumptions, equipment, and rotation fields.
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

const revenantBuildCodec = createProfessionBuildCodec<RevenantCanonicalBuild>({
  professionId: REVENANT_PROFESSION_ID,
  schemaVersion: REVENANT_BUILD_SCHEMA_VERSION,
  catalog: revenantCatalog,
  createDefaults: createRevenantBuildDefaults,
  slotLoadout: revenantLegendLoadout as unknown as Gw2SlotLoadout<RevenantCanonicalBuild>,
  assumptionControls: REVENANT_ASSUMPTION_CONTROLS,
  // Legend resources and Vindicator choices use the same schema in both paths.
  extraFields: {
    initialEnergy: {
      type: 'number',
      minimum: 0,
      maximum: 100
    },
    selectedDodge: {
      type: 'enum',
      values: REVENANT_DODGES
    },
    allianceSide: {
      type: 'enum',
      values: ['luxon', 'kurzick'],
      validationMessage: 'allianceSide must be luxon or kurzick.'
    }
  }
});

export const migrateRevenantBuild = revenantBuildCodec.migrateBuild;
export const validateRevenantBuild = revenantBuildCodec.validateBuild;
export const toApplicationBuild = revenantBuildCodec.toApplicationBuild;
