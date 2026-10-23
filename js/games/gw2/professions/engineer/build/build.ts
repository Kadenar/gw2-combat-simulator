import { WEAPON } from '#gw2/platform/constants.js';
import {
  AMALGAM_MORPH_KIND_BY_SKILL_ID,
  resolveAmalgamSkillId,
  DEFAULT_AMALGAM_MORPHS,
  normalizeAmalgamMorphs,
  validAmalgamMorphs
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { ENGINEER_SKILL_IDS as SKILL } from '#gw2/professions/engineer/data/ids.js';
import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/slots.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { normalizeRotation } from '#gw2/platform/builds/rotation.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import { ENGINEER_ASSUMPTION_CONTROLS } from '#gw2/professions/engineer/build/assumptions.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import type { EngineerCanonicalBuild } from '#gw2/professions/engineer/types.js';
import { createProfessionBuildCodec } from '#gw2/professions/shared/build-codec.js';
import { createCommonBuildDefaults } from '#gw2/professions/shared/build-defaults.js';

/**
 * Engineer persisted-build definition.
 *
 * This module supplies Engineer defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * Its profession-specific rules constrain starting Heat and ensure Amalgam has
 * one legal, unique morph kind in each of F2, F3, and F4.
 */

const ENGINEER_BUILD_SCHEMA_VERSION = 4;
const ENGINEER_PROFESSION_ID = 'engineer';

/** Creates the canonical Engineer build used for new presets and migration fallbacks. */
export function createEngineerBuildDefaults(): EngineerCanonicalBuild {
  return {
    schemaVersion: ENGINEER_BUILD_SCHEMA_VERSION,
    profession: ENGINEER_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Viper's"])),
    alternateWeaponPrefixes: ["Viper's", "Viper's"],
    weapons: [WEAPON.RIFLE, ''],
    alternateWeapons: [WEAPON.PISTOL, WEAPON.SHIELD],
    rune: 'Trapper',
    weaponSigils: normalizeWeaponSigils(DEFAULT_WEAPON_SIGILS),
    relic: 'Fractal',
    food: 'Plate of Beef Rendang',
    utility: 'Toxic Tuning Crystal',
    jadeBotCore: true,
    infusions: [
      { stat: 'Condition Damage', count: 18 },
      { stat: 'Power', count: 0 }
    ],
    specializations: [
      { name: 'Explosives', traits: '3-2-3' },
      { name: 'Firearms', traits: '1-2-3' },
      { name: 'Holosmith', traits: '3-2-2' }
    ],
    selectedSkillIds: {
      Heal: SKILL.HEALING_TURRET,
      Utility1: SKILL.GRENADE_KIT,
      Utility2: SKILL.THROW_MINE,
      Utility3: SKILL.ELIXIR_GUN,
      Elite: SKILL.SUPPLY_CRATE
    },
    selectedMorphSkillIds: [...DEFAULT_AMALGAM_MORPHS],
    ...createCommonBuildDefaults({
      assumptions: {
        inDamagingField: false
      }
    }),
    initialHeat: 0
  };
}

/** Resolves morph casts to the selected slot so imported rotations follow the build's protocol layout. */
function normalizeMorphRotation(savedRotation: unknown, morphIds: readonly number[]): RotationCommand[] {
  const selectedByKind = new Map(morphIds.map((id) => [AMALGAM_MORPH_KIND_BY_SKILL_ID.get(id), id]));
  // Shared normalization resolves names and rejects malformed entries before protocol kinds select slot identities.
  return normalizeRotation(savedRotation, engineerCatalog).map((command) => {
    if (command.type !== 'cast') return command;

    const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(command.skillId);
    const selectedId = kind === undefined ? undefined : selectedByKind.get(kind);
    return { ...command, skillId: selectedId ?? command.skillId };
  });
}

const engineerBuildCodec = createProfessionBuildCodec<EngineerCanonicalBuild>({
  professionId: ENGINEER_PROFESSION_ID,
  schemaVersion: ENGINEER_BUILD_SCHEMA_VERSION,
  catalog: engineerCatalog,
  createDefaults: createEngineerBuildDefaults,
  assumptionControls: ENGINEER_ASSUMPTION_CONTROLS,
  // Heat normalization and validation share this one persisted-field contract.
  extraFields: {
    initialHeat: {
      type: 'number',
      minimum: 0,
      maximum: 150
    }
  },
  normalizeExtra(build, { saved }) {
    // Normalize the morph loadout first so rotation casts use its selected slot identities.
    const selectedMorphSkillIds = normalizeAmalgamMorphs(engineerCatalog, saved.selectedMorphSkillIds);
    return {
      ...build,
      selectedMorphSkillIds,
      // Saved rotations keep one trait-independent Evolve identity; the selected patch's traits choose the variant
      // when the rotation is simulated or displayed, so persisted builds never depend on a trait layout.
      rotation: normalizeMorphRotation(saved.rotation, selectedMorphSkillIds).map((command) =>
        command.type === 'cast' ? { ...command, skillId: resolveAmalgamSkillId(false, command.skillId) } : command
      )
    };
  },
  validateExtra(build) {
    const errors: string[] = [];
    const morphs = Array.isArray(build.selectedMorphSkillIds) ? build.selectedMorphSkillIds : [];

    if (!validAmalgamMorphs(engineerCatalog, morphs)) {
      errors.push('selectedMorphSkillIds must contain one unique legal Amalgam morph for F2, F3, and F4.');
    }

    return errors;
  }
});

/** Migrates persisted Engineer builds to the current canonical schema. */
export const migrateEngineerBuild = engineerBuildCodec.migrateBuild;

/** Validates an Engineer build against the canonical schema and profession-specific constraints. */
export const validateEngineerBuild = engineerBuildCodec.validateBuild;

/** Converts a canonical Engineer build into the shape consumed by the application runtime. */
export const toApplicationBuild = engineerBuildCodec.toApplicationBuild;
