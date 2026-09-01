import type { MesmerConfig } from '#gw2/content/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { MesmerMirageState } from '#gw2/content/professions/mesmer/specializations/mirage/types.js';

export function createMirageState(_config: Partial<MesmerConfig> = {}): MesmerMirageState {
  return {
    ambushUntil: 0,
    ambushSource: '',
    cloneAmbushUntil: 0,
    riddleOfSandReady: false,
    mirrors: []
  };
}

export const mirageState = defineProfessionSpecializationState('Mirage', createMirageState);
