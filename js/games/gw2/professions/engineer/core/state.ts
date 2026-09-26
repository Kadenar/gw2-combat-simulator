import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import {
  ENGINEER_CORE_BALANCE_PROFILES,
  ENGINEER_CORE_BALANCE_PROFILE_IDS
} from '#gw2/professions/engineer/core/profiles.js';
import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';

export interface EngineerCoreState {
  endurance: number;

  enduranceUpdatedAt: number;
  activeKit: string;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  focusedUntil: number;
  lightningRodChargeExpiries: number[];
  lightningRodGeneration: number;
  healingTurretGeneration: number;
  healingTurretActivationId: string;
  kineticCharges: number;
  pendingMineFieldActivationIds: string[];
  traitProcReadyAt: Record<string, number | boolean>;
}

// Core owns the stable public fields that exist for every Engineer runtime.
const ENGINEER_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'endurance',

  'activeKit',
  'availableFlips',
  'autoattackChains',
  'focusedUntil',
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
export function createEngineerCoreState(_config: EngineerConfig = {}): EngineerCoreState {
  return {
    endurance: BASE_MAXIMUM_ENDURANCE,

    enduranceUpdatedAt: 0,
    activeKit: '',
    availableFlips: {},
    autoattackChains: {},
    lightningRodChargeExpiries: [],
    lightningRodGeneration: 0,
    healingTurretGeneration: 0,
    healingTurretActivationId: '',
    focusedUntil: 0,
    kineticCharges: 0,
    pendingMineFieldActivationIds: [],
    traitProcReadyAt: {}
  };
}

// Standalone state factories seed from authored data; live initialization selects the active patch.
const BASE_MAXIMUM_ENDURANCE = requireBalanceNumber(
  ENGINEER_CORE_BALANCE_PROFILES.find((profile) => profile.id === ENGINEER_CORE_BALANCE_PROFILE_IDS.resources)!
    .maximumStacks,
  'engineer resources maximumStacks'
);
