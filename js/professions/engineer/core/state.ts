import type { SkillId } from '../../../platform/engine/types.js';
import type { EngineerConfig, EngineerCoreState } from '../types.js';

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

// Normalizes canonical trait IDs for state initialization.
export function selectedEngineerTraits(config: EngineerConfig = {}): Set<SkillId> {
  return new Set(
    (config.selectedTraitIds || []).map((value) => (Number.isFinite(Number(value)) ? Number(value) : value))
  );
}

export function createEngineerCoreState(_config: EngineerConfig = {}): EngineerCoreState {
  return {
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    activeKit: '',
    availableFlips: {},
    autoattackChains: {},
    lightningRodActivationId: '',
    lightningRodChargeExpiries: [],
    electricArtilleryAvailable: false,
    electricArtilleryReadyAt: 0,
    electricArtilleryExpiresAt: 0,
    focusedUntil: 0,
    kineticCharges: 0,
    traitProcReadyAt: {}
  };
}
