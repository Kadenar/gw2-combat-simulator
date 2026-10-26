import { WEAPON } from '#gw2/platform/constants.js';
import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/slots.js';
import { normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { createProfessionBuildCodec, createProfessionAssumptionDefaults } from '#gw2/professions/shared/build-codec.js';
import { RANGER_ASSUMPTION_CONTROLS } from '#gw2/professions/ranger/build/assumptions.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { isRangerPetName, RANGER_DEFAULT_PET_NAMES } from '#gw2/professions/ranger/data/pets.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import {
  normalizeRangerHammerSkillIds,
  RANGER_HAMMER_VARIANT_PAIRS
} from '#gw2/professions/ranger/data/hammer-variants.js';
import type { RangerCanonicalBuild } from '#gw2/professions/ranger/types.js';
import { createCommonBuildDefaults } from '#gw2/professions/shared/build-defaults.js';
import { rangerPetSkillCommandable } from '#gw2/professions/ranger/data/pet-commands.js';

const RANGER_BUILD_SCHEMA_VERSION = 5;
const RANGER_PROFESSION_ID = 'ranger';

function keepRangerRotationCommand(command: RangerCanonicalBuild['rotation'][number], untamed: boolean): boolean {
  if (command.type !== 'cast') return true;

  const skill = rangerCatalog.skillsById.get(command.skillId);
  // Preserve Untamed's explicit natural pet commands when loading saved rotations.
  return skill?.petAutonomousSkill !== true || (untamed && rangerPetSkillCommandable(skill, 'Untamed'));
}

// Seed a complete, schema-current Ranger preset so migration and UI code can
// safely assume pet, hammer-variant, and specialization resources exist.
export function createRangerBuildDefaults(): RangerCanonicalBuild {
  return {
    schemaVersion: RANGER_BUILD_SCHEMA_VERSION,
    profession: RANGER_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
    weapons: [WEAPON.HAMMER, ''],
    alternateWeapons: [WEAPON.AXE, WEAPON.AXE],
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
      { stat: 'Precision', count: 0 }
    ],
    specializations: [
      { name: 'Skirmishing', traits: '1-2-3' },
      { name: 'Beastmastery', traits: '3-3-3' },
      { name: 'Soulbeast', traits: '2-2-3' }
    ],
    selectedSkillIds: {
      Heal: ID.WE_HEAL_AS_ONE,
      Utility1: ID.SIC_EM,
      Utility2: ID.FROST_TRAP,
      Utility3: ID.SIGNET_OF_THE_WILD,
      Elite: ID.ONE_WOLF_PACK
    },
    selectedPet: RANGER_DEFAULT_PET_NAMES[0],
    selectedPet2: RANGER_DEFAULT_PET_NAMES[1],
    selectedHammerSkillIds: [
      ID.UNLEASHED_WILD_SWING,
      ID.OVERBEARING_SMASH,
      ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
      ID.UNLEASHED_THUMP
    ],
    initialUntamedState: 'Pet',
    ...createCommonBuildDefaults({
      assumptions: createProfessionAssumptionDefaults(RANGER_ASSUMPTION_CONTROLS)
    }),
    initialAstralForce: 100,
    initialArrows: 8
  };
}

const rangerBuildCodec = createProfessionBuildCodec<RangerCanonicalBuild>({
  professionId: RANGER_PROFESSION_ID,
  schemaVersion: RANGER_BUILD_SCHEMA_VERSION,
  catalog: rangerCatalog,
  createDefaults: createRangerBuildDefaults,
  assumptionControls: RANGER_ASSUMPTION_CONTROLS,
  // Starting-state enums and resources share one migration/validation schema.
  extraFields: {
    initialUntamedState: {
      type: 'enum',
      values: ['Pet', 'Ranger'],
      validationMessage: 'initialUntamedState must be either "Pet" or "Ranger".'
    },
    initialAstralForce: {
      type: 'number',
      minimum: 0,
      maximum: 100
    },
    initialArrows: {
      type: 'number',
      minimum: 0,
      maximum: 8
    }
  },
  normalizeExtra(build, { saved }) {
    // Unknown or missing pet names fall back to each slot's default pet.
    const selectedPet = isRangerPetName(saved.selectedPet) ? saved.selectedPet : RANGER_DEFAULT_PET_NAMES[0];
    const selectedPet2 = isRangerPetName(saved.selectedPet2) ? saved.selectedPet2 : RANGER_DEFAULT_PET_NAMES[1];
    return {
      ...build,
      rotation: build.rotation.filter((command) =>
        keepRangerRotationCommand(
          command,
          build.specializations.some((entry) => entry.name === 'Untamed')
        )
      ),
      selectedPet,
      selectedPet2,
      selectedHammerSkillIds: normalizeRangerHammerSkillIds(saved.selectedHammerSkillIds)
    };
  },
  validateExtra(build) {
    const errors: string[] = [];

    if (!isRangerPetName(build.selectedPet)) {
      errors.push('selectedPet must name an available Ranger pet.');
    }

    if (!isRangerPetName(build.selectedPet2)) {
      errors.push('selectedPet2 must name an available Ranger pet.');
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
