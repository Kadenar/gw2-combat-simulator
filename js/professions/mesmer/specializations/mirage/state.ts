import type { MesmerConfig, MesmerMirageState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';

export function createMirageState(_config: Partial<MesmerConfig> = {}): MesmerMirageState {
  return {
    ambushUntil: 0,
    ambushSource: '',
    cloneAmbushUntil: 0,
    riddleOfSandReady: false,
    mirrors: []
  };
}

export function createMirageResolverState(): Record<string, never> {
  return {};
}

export const mirageState = defineProfessionSpecializationState('Mirage', createMirageState);
