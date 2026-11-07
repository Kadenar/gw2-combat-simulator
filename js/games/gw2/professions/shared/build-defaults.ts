import { DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS } from '#gw2/platform/builds/randomness-assumptions.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import { STANDARD_TARGET_ARMOR } from '#gw2/platform/combat/formulas.js';
import { DEFAULT_PERMANENT_COMBO_FIELD_ASSUMPTIONS } from '#gw2/platform/combos/permanent-field-assumption.js';

const DEFAULT_TARGET_CONDITIONS: Readonly<Record<string, number | boolean>> = Object.freeze({
  Bleeding: 1,
  Burning: true,
  Torment: 1,
  Confusion: 1,
  Poisoned: true,
  Chilled: true,
  Crippled: true,
  Slow: true,
  Weakness: true,
  Vulnerability: 25
});

/** Creates a mutable copy of the default target-condition assumptions. */
function createDefaultTargetConditions(): Record<string, number | boolean> {
  return { ...DEFAULT_TARGET_CONDITIONS };
}

const DEFAULT_TARGET_HEALTH = 4_000_000;
const DEFAULT_TARGET_STARTING_HEALTH_PERCENT = 100;
const DEFAULT_STARTING_WEAPON_SET = 1;

/**
 * Additional or overridden assumptions supplied by an individual profession.
 *
 * Examples:
 *
 * Engineer:
 *   { inDamagingField: false }
 *
 * Ranger:
 *   normalizeProfessionAssumptions({}, RANGER_ASSUMPTION_CONTROLS)
 */
type ProfessionAssumptionOverrides = Readonly<Record<string, unknown>>;

/**
 * Creates simulation assumptions shared by all profession build defaults.
 * Each call creates a fresh targetConditions object so builds do not share mutable nested state.
 * Profession-specific assumptions apply last and may override common defaults.
 */
function createDefaultSimulationAssumptions(overrides: ProfessionAssumptionOverrides = {}): ProfessionBuildAssumptions {
  return {
    ...DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS,
    ...DEFAULT_PERMANENT_COMBO_FIELD_ASSUMPTIONS,

    might: 25,

    fury: true,
    quickness: true,
    alacrity: true,

    protection: true,
    resolution: true,
    regeneration: true,
    swiftness: true,
    vigor: true,

    // Benchmark builds assume the standard golem boon set, including permanent Aegis.
    aegis: true,

    targetMoving: false,
    targetConditions: createDefaultTargetConditions(),
    ...overrides
  };
}

interface CommonBuildDefaultsOptions {
  /**
   * Profession-specific assumptions merged into the common assumptions.
   */
  readonly assumptions?: ProfessionAssumptionOverrides;
}

interface CommonBuildDefaults {
  readonly assumptions: ProfessionBuildAssumptions;
  readonly startingWeaponSet: number;
  readonly targetHealth: number;
  readonly targetStartingHealthPercent: number;
  readonly targetArmor: number;
  readonly rotation: RotationCommand[];
}

/**
 * Creates build defaults shared across professions. Weapon and target defaults are fixed here;
 * saved builds store their configured values. Each profession's build.ts defines its gear, weapons,
 * specializations, selected skills, resources, and other profession-specific defaults.
 */
export function createCommonBuildDefaults({ assumptions = {} }: CommonBuildDefaultsOptions = {}): CommonBuildDefaults {
  return {
    assumptions: createDefaultSimulationAssumptions(assumptions),
    startingWeaponSet: DEFAULT_STARTING_WEAPON_SET,
    targetHealth: DEFAULT_TARGET_HEALTH,
    targetStartingHealthPercent: DEFAULT_TARGET_STARTING_HEALTH_PERCENT,
    targetArmor: STANDARD_TARGET_ARMOR,
    rotation: []
  };
}
