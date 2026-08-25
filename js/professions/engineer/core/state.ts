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

// accepts either a pre-built Set (for callers that cache it) or a config object (builds it on demand)
export function hasEngineerTrait(configOrTraits: EngineerConfig | ReadonlySet<SkillId>, traitId: SkillId): boolean {
  const traits =
    typeof (configOrTraits as ReadonlySet<SkillId>).has === 'function'
      ? (configOrTraits as ReadonlySet<SkillId>)
      : selectedEngineerTraits(configOrTraits as EngineerConfig);
  // check both numeric and string representations — the GW2 API can return IDs as either type
  return traits.has(traitId) || traits.has(String(traitId));
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
