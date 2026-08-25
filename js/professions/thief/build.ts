import { GEAR_SLOTS } from '../../platform/gw2/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/equipment/sigils/loadout.js';
import { createGw2BuildCodec } from '../../platform/gw2/builds/codec.js';
import { boundedNumber, enumValue } from '../../platform/gw2/builds/normalization.js';
import { createDefaultTargetConditions } from '../../platform/gw2/builds/default-target-conditions.js';
import { normalizeProfessionAssumptions, validateProfessionAssumptions } from '../../app/profession/assumptions.js';
import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  normalizeSimulationRandomnessAssumptions
} from '../../app/simulation/randomness.js';
import { THIEF_ASSUMPTION_CONTROLS } from './assumptions.js';
import { thiefCatalog, thiefWeaponSkillMatchesSet } from './catalog.js';
import type { ThiefCanonicalBuild, ThiefDodge } from './types.js';
import { createCommonBuildDefaults } from '../lib/build-defaults.js';

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

const THIEF_BUILD_ASSUMPTION_CONTROLS = Object.freeze([
  ...THIEF_ASSUMPTION_CONTROLS,
  ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS
]);
const THIEF_DODGES = Object.freeze(['Dodge', 'Lotus Training', 'Bounding Dodger', 'Unhindered Combatant'] as const);

export { createDefaultTargetConditions };
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
      assumptions: normalizeProfessionAssumptions({}, THIEF_BUILD_ASSUMPTION_CONTROLS)
    }),
    initialInitiative: 12,
    initialShadowForce: 0
  };
}

const thiefBuildCodec = createGw2BuildCodec({
  professionId: THIEF_PROFESSION_ID,
  schemaVersion: THIEF_BUILD_SCHEMA_VERSION,
  catalog: thiefCatalog,
  createDefaults: createThiefBuildDefaults,
  normalizeExtra(build, { saved }) {
    const assumptions = normalizeProfessionAssumptions(
      normalizeSimulationRandomnessAssumptions(build.assumptions),
      THIEF_BUILD_ASSUMPTION_CONTROLS
    );
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
      assumptions,
      initialInitiative: boundedNumber(saved.initialInitiative ?? 12, 0, 0, 15),
      initialShadowForce: boundedNumber(saved.initialShadowForce ?? 0, 0, 0, 100),
      selectedDodge: enumValue(String(saved.selectedDodge), THIEF_DODGES, 'Dodge') as ThiefDodge
    };
  },
  validateExtra(build) {
    const errors = validateProfessionAssumptions(build.assumptions, THIEF_BUILD_ASSUMPTION_CONTROLS);
    if (!(Number(build.initialInitiative) >= 0 && Number(build.initialInitiative) <= 15))
      errors.push('initialInitiative must be between 0 and 15.');
    if (!(Number(build.initialShadowForce) >= 0 && Number(build.initialShadowForce) <= 100))
      errors.push('initialShadowForce must be between 0 and 100.');
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
