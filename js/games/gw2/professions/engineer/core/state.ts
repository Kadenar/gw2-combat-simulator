import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import {
  ENGINEER_CORE_BALANCE_PROFILES,
  ENGINEER_CORE_BALANCE_PROFILE_IDS
} from '#gw2/professions/engineer/core/profiles.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';

export interface EngineerCoreState {
  endurance: ResourceClock;
  /** The equip skill identifies the active bundle independently of its display name. */
  activeKit: SkillId | null;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  lightningRodChargeExpiries: number[];
  lightningRodGeneration: number;
  healingTurretGeneration: number;
  healingTurretActivationId: string;
  kineticCharges: number;
  pendingMineFieldActivationIds: string[];
  explosiveEntranceFired: boolean;
  aimAssistedRocketCount: number;
}

// Core owns the stable public fields that exist for every Engineer runtime.
const ENGINEER_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'endurance',

  'activeKit',
  'availableFlips',
  'autoattackChains',
  'lightningRodChargeExpiries',
  'kineticCharges'
] as const satisfies readonly (keyof EngineerCoreState)[]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const ENGINEER_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: ENGINEER_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});

/** Normalizes canonical trait IDs for state initialization and runtime membership checks. */
export function selectedEngineerTraits(config: EngineerConfig = {}): Set<SkillId> {
  return normalizeSelectedTraitIds(config.selectedTraitIds);
}

/** Creates a fresh Core Engineer state with resources, kit state, flips, and proc windows reset. */
export function createEngineerCoreState(): EngineerCoreState {
  return {
    endurance: createResourceClock(BASE_MAXIMUM_ENDURANCE),
    activeKit: null,
    availableFlips: {},
    autoattackChains: {},
    lightningRodChargeExpiries: [],
    lightningRodGeneration: 0,
    healingTurretGeneration: 0,
    healingTurretActivationId: '',
    kineticCharges: 0,
    pendingMineFieldActivationIds: [],
    explosiveEntranceFired: false,
    aimAssistedRocketCount: 0
  };
}

// Standalone state factories seed from authored data; live initialization selects the active patch.
const BASE_MAXIMUM_ENDURANCE = requireBalanceNumber(
  ENGINEER_CORE_BALANCE_PROFILES.find((profile) => profile.id === ENGINEER_CORE_BALANCE_PROFILE_IDS.resources)!
    .maximumStacks,
  'engineer resources maximumStacks'
);
