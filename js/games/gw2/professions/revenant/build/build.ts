import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { createProfessionBuildCodec } from '#gw2/professions/lib/build-codec.js';
import { REVENANT_ASSUMPTION_CONTROLS } from '#gw2/professions/revenant/build/assumptions.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import type { RevenantCanonicalBuild } from '#gw2/professions/revenant/types.js';
import { createCommonBuildDefaults } from '#gw2/professions/lib/build-defaults.js';

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
  slotLoadout: revenantLegendLoadout,
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
