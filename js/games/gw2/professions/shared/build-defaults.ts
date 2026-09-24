import { DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS } from '#gw2/platform/simulation/randomness.js';
import { DEFAULT_PERMANENT_COMBO_FIELD_ASSUMPTIONS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { createDefaultTargetConditions } from '#gw2/platform/builds/default-target-conditions.js';
import type { RotationCommand } from '#gw2/platform/execution/types.js';
import type { ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';

const DEFAULT_TARGET_HEALTH = 4_000_000;
const DEFAULT_TARGET_STARTING_HEALTH_PERCENT = 100;
const DEFAULT_TARGET_ARMOR = 2597;
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
export type ProfessionAssumptionOverrides = Readonly<Record<string, unknown>>;

/**
 * Creates the simulation assumptions shared by all profession build defaults.
 *
 * A fresh targetConditions object is created every time so builds do not share
 * mutable nested state.
 *
 * Profession-specific assumptions are applied last and may intentionally
 * override a common default.
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

export interface CommonBuildDefaultsOptions {
  /**
   * Profession-specific assumptions merged into the common assumptions.
   */
  readonly assumptions?: ProfessionAssumptionOverrides;
  readonly startingWeaponSet?: number;
  readonly targetHealth?: number;
  readonly targetArmor?: number;
}

export interface CommonBuildDefaults {
  readonly assumptions: ProfessionBuildAssumptions;
  readonly startingWeaponSet: number;
  readonly targetHealth: number;
  readonly targetStartingHealthPercent: number;
  readonly targetArmor: number;
  readonly rotation: RotationCommand[];
}

/**
 * Creates the portion of a canonical profession build that is identical across
 * professions.
 *
 * Gear, weapons, specializations, selected skills, resources, and other
 * profession-specific defaults intentionally remain in the profession's own
 * build.ts.
 */
export function createCommonBuildDefaults({
  assumptions = {},
  startingWeaponSet = DEFAULT_STARTING_WEAPON_SET,
  targetHealth = DEFAULT_TARGET_HEALTH,
  targetArmor = DEFAULT_TARGET_ARMOR
}: CommonBuildDefaultsOptions = {}): CommonBuildDefaults {
  return {
    assumptions: createDefaultSimulationAssumptions(assumptions),
    startingWeaponSet,
    targetHealth,
    targetStartingHealthPercent: DEFAULT_TARGET_STARTING_HEALTH_PERCENT,
    targetArmor,
    rotation: []
  };
}
