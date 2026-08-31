import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { createDefaultTargetConditions } from '#gw2/platform/builds/default-target-conditions.js';
import { createProfessionBuildCodec, normalizeProfessionBuildAssumptions } from '#gw2/content/professions/lib/build-codec.js';
import { THIEF_ASSUMPTION_CONTROLS } from '#gw2/content/professions/thief/app/assumptions.js';
import { thiefCatalog, thiefWeaponSkillMatchesSet } from '#gw2/content/professions/thief/catalog.js';
import type { ThiefCanonicalBuild } from '#gw2/content/professions/thief/types.js';
import { createCommonBuildDefaults } from '#gw2/content/professions/lib/build-defaults.js';

/**
 * Thief persisted-build definition.
 *
 * This module supplies Thief defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * It normalizes Thief assumptions, initiative, shadow force, and dodge choice,
 * and rejects weapon sets that cannot supply a legal dual-wield slot-3 skill.
 */

export const THIEF_BUILD_SCHEMA_VERSION = 3;
export const THIEF_PROFESSION_ID = 'thief';

const THIEF_DODGES = Object.freeze(['Dodge', 'Lotus Training', 'Bounding Dodger', 'Unhindered Combatant'] as const);

export { createDefaultTargetConditions };
// Seed a complete, schema-current Thief preset with resources, equipment,
// assumptions, selected skills, and specialization state.
export function createThiefBuildDefaults(): ThiefCanonicalBuild {
  return {
    schemaVersion: THIEF_BUILD_SCHEMA_VERSION,
    profession: THIEF_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
    weapons: ['Rifle', ''],
    alternateWeapons: ['Dagger', 'Pistol'],
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
      { name: 'Deadly Arts', traits: '1-3-3' },
      { name: 'Critical Strikes', traits: '3-2-1' },
      { name: 'Deadeye', traits: '1-3-1' }
    ],
    selectedSkills: {
      Heal: 'Hide in Shadows',
      Utility1: "Assassin's Signet",
      Utility2: 'Shadow Flare',
      Utility3: 'Shadow Gust',
      Elite: 'Thieves Guild'
    },
    selectedDodge: 'Dodge',
    ...createCommonBuildDefaults({
      assumptions: normalizeProfessionBuildAssumptions({}, THIEF_ASSUMPTION_CONTROLS)
    }),
    initialInitiative: 12,
    initialShadowForce: 0
  };
}

const thiefBuildCodec = createProfessionBuildCodec<ThiefCanonicalBuild>({
  professionId: THIEF_PROFESSION_ID,
  schemaVersion: THIEF_BUILD_SCHEMA_VERSION,
  catalog: thiefCatalog,
  createDefaults: createThiefBuildDefaults,
  assumptionControls: THIEF_ASSUMPTION_CONTROLS,
  // Initiative, shadow force, and dodge choice share one persisted schema.
  extraFields: {
    initialInitiative: {
      type: 'number',
      minimum: 0,
      maximum: 15
    },
    initialShadowForce: {
      type: 'number',
      minimum: 0,
      maximum: 100
    },
    selectedDodge: {
      type: 'enum',
      values: THIEF_DODGES
    }
  },
  normalizeExtra(build) {
    const assumptions = { ...build.assumptions };
    delete assumptions.markedTargetChoice;
    delete assumptions.playerHealthPercent;
    delete assumptions.targetDistance;
    delete assumptions.artifactDrawSequence;
    delete assumptions.doubleEdgeOutcomeSequence;
    // Stolen skills moved from persisted assumptions to choices made from the live profession palette.
    delete assumptions.stolenSkillChoice;
    delete assumptions.deadeyeStolenSkillChoice;
    return {
      ...build,
      assumptions
    };
  },
  validateExtra(build) {
    const errors: string[] = [];
    for (const pair of [build.weapons, build.alternateWeapons]) {
      if (!Array.isArray(pair)) continue;
      const [mainHand] = pair;
      if (thiefCatalog.weaponHands.get(mainHand) === '2h') continue;
      const hasThirdSkill = thiefCatalog.skills.some(
        (skill) =>
          skill.type === 'Weapon' &&
          skill.slot === 'Weapon_3' &&
          !skill.flipParentId &&
          thiefWeaponSkillMatchesSet(skill, pair, {
            catalog: thiefCatalog
          })
      );
      if (!hasThirdSkill) {
        errors.push(`weapon set ${pair[0] || 'empty'}/${pair[1] || 'empty'} has no legal Thief slot-3 skill.`);
      }
    }

    return errors;
  }
});
export const migrateThiefBuild = thiefBuildCodec.migrateBuild;
export const validateThiefBuild = thiefBuildCodec.validateBuild;
export const toApplicationBuild = thiefBuildCodec.toApplicationBuild;
