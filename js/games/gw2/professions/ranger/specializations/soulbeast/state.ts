import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { selectedRangerPet } from '#gw2/professions/ranger/core/state.js';
import type { RangerConfig, RangerState, SoulbeastState } from '#gw2/professions/ranger/types.js';

// Soulbeast owns its public Beastmode and stance projection.
export const SOULBEAST_PUBLIC_END_STATE_KEYS: readonly (keyof RangerState)[] = Object.freeze([
  'beastmodeActive',
  'archetype',
  'oneWolfPackUntil',
  'oneWolfPackReadyAt'
]);

export const SOULBEAST_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RangerState>> = Object.freeze({
  beastmodeActive: false,
  archetype: '',
  oneWolfPackUntil: 0,
  oneWolfPackReadyAt: 0
});

export function createSoulbeastState(config: RangerConfig = {}): SoulbeastState {
  const pet = selectedRangerPet(config);
  return {
    // Soulbeast starts merged — the rotation begins in Beastmode by default.
    beastmodeActive: true,
    archetype: pet?.archetype || '',
    oneWolfPackUntil: 0,
    oneWolfPackReadyAt: 0,
    goForTheEyesReadyAt: 0,
    beastlyWardenReadyAt: 0,
    goForTheThroatReadyAt: 0,
    bestialRageReadyAt: 0,
    essenceOfSpeedReadyAt: 0,
    vultureStanceReadyAt: 0,
    // Tracks per-activation-id whether the beast-ability first-hit proc already fired, preventing multi-hit skills from triggering trait effects more than once per cast.
    beastAbilityActivations: {}
  };
}

export const soulbeastState = defineProfessionSpecializationState('Soulbeast', createSoulbeastState);
