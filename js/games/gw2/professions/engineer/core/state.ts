import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';

export interface EngineerCoreState {
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  activeKit: string;
  availableFlips: Record<string, boolean>;
  autoattackChains: Record<string, SkillId>;
  focusedUntil: number;
  lightningRodChargeExpiries: number[];
  healingTurretActivationId: string;
  electricArtilleryAvailable: boolean;
  electricArtilleryReadyAt: number;
  electricArtilleryExpiresAt: number;
  kineticCharges: number;
  pendingMineFieldActivationIds: string[];
  traitProcReadyAt: Record<string, number | boolean>;
}

// Core owns the stable public fields that exist for every Engineer runtime.
export const ENGINEER_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'endurance',
  'maximumEndurance',
  'activeKit',
  'availableFlips',
  'autoattackChains',
  'focusedUntil',
  'lightningRodChargeExpiries',
  'electricArtilleryAvailable',
  'electricArtilleryReadyAt',
  'electricArtilleryExpiresAt',
  'kineticCharges'
] as const satisfies readonly (keyof EngineerCoreState)[]);

/** Normalizes canonical trait IDs for state initialization and runtime membership checks. */
export function selectedEngineerTraits(config: EngineerConfig = {}): Set<SkillId> {
  return normalizeSelectedTraitIds(config.selectedTraitIds);
}

/** Creates a fresh Core Engineer state with resources, kit state, flips, and proc windows reset. */
export function createEngineerCoreState(_config: EngineerConfig = {}): EngineerCoreState {
  return {
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    activeKit: '',
    availableFlips: {},
    autoattackChains: {},
    lightningRodChargeExpiries: [],
    healingTurretActivationId: '',
    electricArtilleryAvailable: false,
    electricArtilleryReadyAt: 0,
    electricArtilleryExpiresAt: 0,
    focusedUntil: 0,
    kineticCharges: 0,
    pendingMineFieldActivationIds: [],
    traitProcReadyAt: {}
  };
}
