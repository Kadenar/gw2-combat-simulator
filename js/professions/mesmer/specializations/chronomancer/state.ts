import type { MesmerChronomancerState, MesmerConfig } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';

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
