import { GEAR_SLOTS } from '../../platform/gw2/gear-data.js';
import { normalizeWeaponSigils } from '../../platform/gw2/weapon-sigils.js';
import { createGw2BuildCodec } from '../../platform/gw2/build-codec.js';
import { enumValue } from '../../platform/gw2/build-normalization.js';
import { createDefaultTargetConditions } from '../../platform/gw2/default-target-conditions.js';
import { normalizeProfessionAssumptions, validateProfessionAssumptions } from '../../app/profession/assumptions.js';
import { normalizeSimulationRandomnessAssumptions } from '../../app/simulation/randomness.js';
import { RANGER_ASSUMPTION_CONTROLS } from './assumptions.js';
import { rangerCatalog } from './catalog.js';
import { RANGER_PETS } from './data/ranger-pet-data.js';
import { RANGER_SKILL_IDS as ID } from './data/ids.js';
import { normalizeRangerHammerSkillIds, RANGER_HAMMER_VARIANT_PAIRS } from './core/hammer.js';
import type { RangerCanonicalBuild } from './types.js';
import { createCommonBuildDefaults } from '../lib/build-defaults.js';

export const RANGER_BUILD_SCHEMA_VERSION = 4;
export const RANGER_PROFESSION_ID = 'ranger';

export { createDefaultTargetConditions };

function keepRangerRotationCommand(command: RangerCanonicalBuild['rotation'][number]): boolean {
  if (command.type !== 'cast') return true;
  if (command.skillId === ID.OVERBEARING_SMASH_SECOND_STRIKE || command.skillId === 'Overbearing Smash (Follow-Up)') {
    return false;
  }

  const numericId = Number(command.skillId);
  const skill = Number.isFinite(numericId)
    ? rangerCatalog.skillsById.get(numericId)
    : rangerCatalog.skillsByName.get(String(command.skillId));
  return skill?.petAutonomousSkill !== true;
}

export function createRangerBuildDefaults(): RangerCanonicalBuild {
  return {
    schemaVersion: RANGER_BUILD_SCHEMA_VERSION,
    profession: RANGER_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
    weapons: ['Hammer', ''],
    alternateWeapons: ['Axe', 'Axe'],
    rune: 'Scholar',
    weaponSigils: normalizeWeaponSigils([
      ['Force', 'Air'],
      ['Force', 'Impact']
    ]),
    relic: 'Claw',
    food: 'Cilantro Lime Sous-Vide Steak',
    utility: 'Superior Sharpening Stone',
    jadeBotCore: true,
    infusions: [
      { stat: 'Power', count: 18 },
      { stat: 'Precision', count: 0 },
      { stat: 'Condition Damage', count: 0 }
    ],
    specializations: [
      { name: 'Skirmishing', traits: '1-2-3' },
      { name: 'Beastmastery', traits: '3-3-3' },
      { name: 'Soulbeast', traits: '2-2-3' }
    ],
    selectedSkills: {
      Heal: '"We Heal As One!"',
      Utility1: '"Sic \'Em!"',
      Utility2: 'Frost Trap',
      Utility3: 'Signet of the Wild',
      Elite: 'One Wolf Pack'
    },
    selectedPet: 'Pig',
    selectedPet2: 'Lynx',
    selectedHammerSkillIds: [
      ID.UNLEASHED_WILD_SWING,
      ID.OVERBEARING_SMASH,
      ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
      ID.UNLEASHED_THUMP
    ],
    initialUntamedState: 'Pet',
    ...createCommonBuildDefaults({
      assumptions: normalizeProfessionAssumptions({}, RANGER_ASSUMPTION_CONTROLS)
    }),
    initialAstralForce: 100,
    initialArrows: 8
  };
}

const rangerBuildCodec = createGw2BuildCodec<RangerCanonicalBuild>({
  professionId: RANGER_PROFESSION_ID,
  schemaVersion: RANGER_BUILD_SCHEMA_VERSION,
  catalog: rangerCatalog,
  createDefaults: createRangerBuildDefaults,
  normalizeExtra(build, { saved }) {
    const savedAssumptions =
      saved.assumptions && typeof saved.assumptions === 'object' ? (saved.assumptions as Record<string, unknown>) : {};
    const {
      selectedPet: _legacySelectedPet,
      soulbeastArchetype: _legacySoulbeastArchetype,
      playerHealthPercent: _legacyPlayerHealthPercent,
      targetDistance: _legacyTargetDistance,
      astralForceHealingEventsPerSecond: _fakeAstralForceHealingRate,
      ...supportedAssumptions
    } = build.assumptions;
    const assumptions = normalizeProfessionAssumptions(
      normalizeSimulationRandomnessAssumptions(supportedAssumptions),
      RANGER_ASSUMPTION_CONTROLS
    );
    const requestedPet = String(saved.selectedPet ?? savedAssumptions.selectedPet ?? 'Pig');
    const selectedPet = RANGER_PETS.some((pet) => pet.name === requestedPet) ? requestedPet : 'Pig';
    const requestedPet2 = String(saved.selectedPet2 ?? 'Lynx');
    const selectedPet2 = RANGER_PETS.some((pet) => pet.name === requestedPet2) ? requestedPet2 : 'Lynx';
    return {
      ...build,
      rotation: build.rotation.filter(keepRangerRotationCommand),
      assumptions,
      selectedPet,
      selectedPet2,
      selectedHammerSkillIds: normalizeRangerHammerSkillIds(saved.selectedHammerSkillIds),
      initialUntamedState: enumValue(saved.initialUntamedState, ['Pet', 'Ranger'], 'Pet'),
      initialAstralForce: Math.max(0, Math.min(100, Number(saved.initialAstralForce ?? 100))),
      initialArrows: Math.max(0, Math.min(8, Number(saved.initialArrows ?? 8)))
    };
  },
  validateExtra(build) {
    const errors = validateProfessionAssumptions(build.assumptions, RANGER_ASSUMPTION_CONTROLS);
    if (!(Number(build.initialAstralForce) >= 0 && Number(build.initialAstralForce) <= 100)) {
      errors.push('initialAstralForce must be between 0 and 100.');
    }

    if (!(Number(build.initialArrows) >= 0 && Number(build.initialArrows) <= 8)) {
      errors.push('initialArrows must be between 0 and 8.');
    }

    if (!RANGER_PETS.some((pet) => pet.name === build.selectedPet)) {
      errors.push('selectedPet must name an available Ranger pet.');
    }

    if (!RANGER_PETS.some((pet) => pet.name === build.selectedPet2)) {
      errors.push('selectedPet2 must name an available Ranger pet.');
    }

    if (!['Pet', 'Ranger'].includes(build.initialUntamedState)) {
      errors.push('initialUntamedState must be either "Pet" or "Ranger".');
    }

    const selectedHammerSkillIds = Array.isArray(build.selectedHammerSkillIds)
      ? build.selectedHammerSkillIds.map(Number)
      : [];
    if (
      selectedHammerSkillIds.length !== RANGER_HAMMER_VARIANT_PAIRS.length ||
      RANGER_HAMMER_VARIANT_PAIRS.some((pair, index) => !pair.includes(selectedHammerSkillIds[index]))
    ) {
      errors.push('selectedHammerSkillIds must contain one legal Hammer skill for slots 2, 3, 4, and 5.');
    }

    return errors;
  }
});

export const migrateRangerBuild = rangerBuildCodec.migrateBuild;
export const validateRangerBuild = rangerBuildCodec.validateBuild;
export const toApplicationBuild = rangerBuildCodec.toApplicationBuild;
