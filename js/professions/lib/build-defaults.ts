import { DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS } from '../../app/simulation/randomness.js';
import { createDefaultTargetConditions } from '../../platform/gw2/builds/default-target-conditions.js';
import type { RotationCommand, SchedulerRecord } from '../../platform/engine/types.js';

export const DEFAULT_TARGET_HEALTH = 4_000_000;
export const DEFAULT_TARGET_ARMOR = 2597;
export const DEFAULT_STARTING_WEAPON_SET = 1;

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
export function createDefaultSimulationAssumptions(overrides: ProfessionAssumptionOverrides = {}): SchedulerRecord {
  return {
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
  readonly assumptions: SchedulerRecord;
  readonly startingWeaponSet: number;
  readonly targetHealth: number;
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
    targetArmor,
    rotation: []
  };
}
