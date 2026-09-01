import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { warriorCatalog } from '#gw2/content/professions/warrior/catalog.js';
import type { WarriorCanonicalBuild } from '#gw2/content/professions/warrior/types.js';
import { createProfessionBuildCodec } from '#gw2/content/professions/lib/build-codec.js';
import { createCommonBuildDefaults } from '#gw2/content/professions/lib/build-defaults.js';

export const WARRIOR_BUILD_SCHEMA_VERSION = 3;
export const WARRIOR_PROFESSION_ID = 'warrior';

// Seed a complete, schema-current Warrior preset with resources, equipment,
// assumptions, selected skills, and specialization fields.
export function createWarriorBuildDefaults(): WarriorCanonicalBuild {
  return {
    schemaVersion: WARRIOR_BUILD_SCHEMA_VERSION,
    profession: WARRIOR_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
    weapons: ['Axe', 'Axe'],
    alternateWeapons: ['Greatsword', ''],
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
      { name: 'Strength', traits: '1-1-1' },
      { name: 'Discipline', traits: '2-3-3' },
      { name: 'Berserker', traits: '1-1-1' }
    ],
    selectedSkills: {
      Heal: 'Blood Reckoning',
      Utility1: 'Signet of Might',
      Utility2: 'Outrage',
      Utility3: 'Wild Blow',
      Elite: 'Head Butt'
    },
    ...createCommonBuildDefaults(),
    initialResource: 0
  };
}

const warriorBuildCodec = createProfessionBuildCodec<WarriorCanonicalBuild>({
  professionId: WARRIOR_PROFESSION_ID,
  schemaVersion: WARRIOR_BUILD_SCHEMA_VERSION,
  catalog: warriorCatalog,
  createDefaults: createWarriorBuildDefaults,
  // The descriptor is the single contract for persisted adrenaline/flow bounds.
  extraFields: {
    initialResource: {
      type: 'number',
      minimum: 0,
      maximum: 100
    }
  }
});

export const migrateWarriorBuild = warriorBuildCodec.migrateBuild;
export const validateWarriorBuild = warriorBuildCodec.validateBuild;
export const toApplicationBuild = warriorBuildCodec.toApplicationBuild;
