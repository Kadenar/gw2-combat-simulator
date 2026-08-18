import { GEAR_SLOTS } from '../../platform/gw2/gear-data.js';
import { DEFAULT_WEAPON_SIGILS, normalizeWeaponSigils } from '../../platform/gw2/weapon-sigils.js';
import { createGw2BuildCodec } from '../../platform/gw2/build-codec.js';
import { createDefaultTargetConditions } from '../../platform/gw2/default-target-conditions.js';
import {
  DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS,
  normalizeSimulationRandomnessAssumptions,
  validateSimulationRandomnessAssumptions
} from '../../app/simulation/randomness.js';
import { engineerCatalog } from './catalog.js';
import type { RotationCommand, SchedulerRecord, Skill } from '../../platform/engine/types.js';
import type { EngineerCanonicalBuild } from './types.js';

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

export { createDefaultTargetConditions };

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
      Utility3: 'Rifle Turret',
      Elite: 'Supply Crate'
    },
    selectedMorphSkillIds: [...DEFAULT_MORPHS],
    assumptions: {
      ...DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS,
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
      inDamagingField: false,
      targetConditions: createDefaultTargetConditions()
    },
    initialHeat: 0,
    startingWeaponSet: 1,
    targetHealth: 3_970_000,
    targetArmor: 2597,
    rotation: []
  };
}

function normalizeMorphs(value: unknown): number[] {
  const source = Array.isArray(value) ? value : DEFAULT_MORPHS;
  const selected = new Map<number, number>();
  const selectedNames = new Set<string>();
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

function normalizeMorphRotation(
  rotation: readonly RotationCommand[],
  savedRotation: unknown,
  morphIds: readonly number[]
): RotationCommand[] {
  const selectedByName = new Map<string, Skill>(
    morphIds
      .map((skillId) => {
        const skill = engineerCatalog.skillsById.get(Number(skillId));
        return [skill?.name, skill];
      })
      .filter(([name, skill]) => name && skill) as [string, Skill][]
  );
  const rawRotation = Array.isArray(savedRotation) ? savedRotation : [];
  return rotation.map((command, index) => {
    const raw = rawRotation[index];
    const rawCommand = raw && typeof raw === 'object' ? (raw as SchedulerRecord) : null;
    const legacyName =
      typeof raw === 'string'
        ? raw
        : rawCommand && rawCommand.skillId == null && rawCommand.id == null && typeof rawCommand.name === 'string'
          ? rawCommand.name
          : null;
    const selected = legacyName == null ? undefined : selectedByName.get(legacyName);
    return command.type === 'cast' && selected ? { ...command, skillId: selected.id } : command;
  });
}

const engineerBuildCodec = createGw2BuildCodec<EngineerCanonicalBuild>({
  professionId: ENGINEER_PROFESSION_ID,
  schemaVersion: ENGINEER_BUILD_SCHEMA_VERSION,
  catalog: engineerCatalog,
  createDefaults: createEngineerBuildDefaults,
  normalizeExtra(build, { saved }) {
    const selectedMorphSkillIds = normalizeMorphs(saved.selectedMorphSkillIds);
    return {
      ...build,
      assumptions: normalizeSimulationRandomnessAssumptions(build.assumptions),
      initialHeat: Math.max(0, Math.min(150, Number(saved.initialHeat ?? 0) || 0)),
      selectedMorphSkillIds,
      rotation: normalizeMorphRotation(build.rotation, saved.rotation, selectedMorphSkillIds)
    };
  },
  validateExtra(build) {
    const errors = validateSimulationRandomnessAssumptions(build.assumptions);
    if (!(Number(build.initialHeat) >= 0 && Number(build.initialHeat) <= 150)) {
      errors.push('initialHeat must be between 0 and 150.');
    }
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

export const migrateEngineerBuild = engineerBuildCodec.migrateBuild;
export const validateEngineerBuild = engineerBuildCodec.validateBuild;
export const toApplicationBuild = engineerBuildCodec.toApplicationBuild;
