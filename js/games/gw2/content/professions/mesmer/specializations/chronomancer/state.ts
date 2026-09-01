import type { MesmerConfig } from '#gw2/content/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { MesmerChronomancerState } from '#gw2/content/professions/mesmer/specializations/chronomancer/types.js';

export function createChronomancerState(_config: Partial<MesmerConfig> = {}): MesmerChronomancerState {
  return {
    continuum: null,
    timeBombUntil: 0
  };
}

export function createChronomancerResolverState(): Record<string, never> {
  return {};
}

export const chronomancerState = defineProfessionSpecializationState('Chronomancer', createChronomancerState);
