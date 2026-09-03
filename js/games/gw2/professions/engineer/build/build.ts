import { GEAR_SLOTS } from '#gw2/platform/equipment/gear/stats.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import { createProfessionBuildCodec } from '#gw2/professions/lib/build-codec.js';
import { createCommonBuildDefaults } from '#gw2/professions/lib/build-defaults.js';
import { ENGINEER_ASSUMPTION_CONTROLS } from '#gw2/professions/engineer/build/assumptions.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import type { RotationCommand, SchedulerRecord, Skill } from '#gw2/platform/engine/types.js';
import type { EngineerCanonicalBuild } from '#gw2/professions/engineer/types.js';

/**
 * Engineer persisted-build definition.
 *
 * This module supplies Engineer defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * Its profession-specific rules constrain starting Heat and ensure Amalgam has
 * one legal, uniquely named morph in each of F2, F3, and F4.
 */

export const ENGINEER_BUILD_SCHEMA_VERSION = 3;
export const ENGINEER_PROFESSION_ID = 'engineer';

const DEFAULT_MORPHS = Object.freeze([77103, 77203, 76954]);
const AMALGAM_MORPHS = new Set(
  engineerCatalog.skills
    .filter(
      (skill) =>
        skill.specialization === 'Amalgam' &&
        [2, 3, 4].includes(Number(skill.mechanicSlot)) &&
        skill.categories?.includes('Morph')
    )
    .map((skill) => skill.id)
);

/** Creates the canonical Engineer build used for new presets and migration fallbacks. */
export function createEngineerBuildDefaults(): EngineerCanonicalBuild {
  return {
    schemaVersion: ENGINEER_BUILD_SCHEMA_VERSION,
    profession: ENGINEER_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Viper's"])),
    alternateWeaponPrefixes: ["Viper's", "Viper's"],
    weapons: ['Rifle', ''],
    alternateWeapons: ['Pistol', 'Shield'],
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
      { name: 'Explosives', traits: '3-2-3' },
      { name: 'Firearms', traits: '1-2-3' },
      { name: 'Holosmith', traits: '3-2-2' }
    ],
    selectedSkills: {
      Heal: 'Healing Turret',
      Utility1: 'Grenade Kit',
      Utility2: 'Throw Mine',
      Utility3: 'Elixir Gun',
      Elite: 'Supply Crate'
    },
    selectedMorphSkillIds: [...DEFAULT_MORPHS],
    ...createCommonBuildDefaults({
      assumptions: {
        inDamagingField: false
      }
    }),
    initialHeat: 0
  };
}

/** Keeps one legal, uniquely named Amalgam morph in each configurable profession slot. */
function normalizeMorphs(value: unknown): number[] {
  const source = Array.isArray(value) ? value : DEFAULT_MORPHS;
  const selected = new Map<number, number>();
  const selectedNames = new Set<string>();
  // Retain only legal saved choices while enforcing one unique morph name per profession slot.
  for (const rawId of source) {
    const id = Number(rawId);
    const skill = engineerCatalog.skillsById.get(id);
    const slot = Number(skill?.mechanicSlot);
    if (!AMALGAM_MORPHS.has(id) || ![2, 3, 4].includes(slot)) {
      continue;
    }

    if (selectedNames.has(skill!.name)) continue;
    if (selected.has(slot)) continue;
    selected.set(slot, id);
    selectedNames.add(skill!.name);
  }

  // Fill any missing slots from canonical defaults, then other legal morphs when a name is already used.
  for (const slot of [2, 3, 4]) {
    if (selected.has(slot)) continue;
    const defaultId = DEFAULT_MORPHS[slot - 2];
    const candidates = [
      engineerCatalog.skillsById.get(defaultId),
      ...engineerCatalog.skills.filter((skill) => AMALGAM_MORPHS.has(skill.id) && Number(skill.mechanicSlot) === slot)
    ].filter(Boolean) as Skill[];
    const replacement = candidates.find((skill) => !selectedNames.has(skill.name));
    if (!replacement) continue;
    selected.set(slot, replacement.id as number);
    selectedNames.add(replacement.name);
  }

  return [2, 3, 4].map((slot) => selected.get(slot)) as number[];
}

/** Normalizes each raw command before rebinding legacy morph names to the selected IDs. */
function normalizeMorphRotation(savedRotation: unknown, morphIds: readonly number[]): RotationCommand[] {
  const selectedByName = new Map<string, Skill>(
    morphIds
      .map((skillId) => {
        const skill = engineerCatalog.skillsById.get(Number(skillId));
        return [skill?.name, skill];
      })
      .filter(([name, skill]) => name && skill) as [string, Skill][]
  );
  const rawRotation = Array.isArray(savedRotation) ? savedRotation : [];
  return rawRotation.flatMap((raw) => {
    // Normalize one raw entry at a time so dropping a malformed command cannot shift later name-based casts.
    const [command] = normalizeRotation([raw], engineerCatalog);
    if (!command) return [];
    const rawCommand = raw && typeof raw === 'object' ? (raw as SchedulerRecord) : null;
    const legacyName =
      typeof raw === 'string'
        ? raw
        : rawCommand && rawCommand.skillId == null && rawCommand.id == null && typeof rawCommand.name === 'string'
          ? rawCommand.name
          : null;
    const selected = legacyName == null ? undefined : selectedByName.get(legacyName);
    return [command.type === 'cast' && selected ? { ...command, skillId: selected.id } : command];
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
    // Normalize the morph loadout first because legacy rotation entries depend on the selected IDs.
    const selectedMorphSkillIds = normalizeMorphs(saved.selectedMorphSkillIds);
    return {
      ...build,
      selectedMorphSkillIds,
      rotation: normalizeMorphRotation(saved.rotation, selectedMorphSkillIds)
    };
  },
  validateExtra(build) {
    const errors: string[] = [];
    const morphs = Array.isArray(build.selectedMorphSkillIds) ? build.selectedMorphSkillIds : [];
    const slots = morphs.map((id) => Number(engineerCatalog.skillsById.get(Number(id))?.mechanicSlot));
    const names = morphs.map((id) => engineerCatalog.skillsById.get(Number(id))?.name);
    if (
      morphs.length !== 3 ||
      morphs.some((id) => !AMALGAM_MORPHS.has(Number(id))) ||
      new Set(slots).size !== 3 ||
      new Set(names).size !== 3 ||
      slots.some((slot) => ![2, 3, 4].includes(slot))
    ) {
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
