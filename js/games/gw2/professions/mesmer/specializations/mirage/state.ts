import type { MesmerConfig } from '#gw2/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export interface MesmerMirageMirror {
  availableAt: number;
  expiresAt: number;
  source: string;
}

export interface MesmerMirageState {
  pendingMirrorAts: number[];
  endurance: number;

  enduranceUpdatedAt: number;
  ambushUntil: number;
  ambushSource: string;
  cloneAmbushUntil: number;
  riddleOfSandReady: boolean;
  mirrors: MesmerMirageMirror[];
}

function createMirageState(_config: Partial<MesmerConfig> = {}): MesmerMirageState {
  return {
    pendingMirrorAts: [],
    // Mirage starts with two dodges' worth of continuously regenerating endurance.
    endurance: 100,

    enduranceUpdatedAt: 0,
    ambushUntil: 0,
    ambushSource: '',
    cloneAmbushUntil: 0,
    riddleOfSandReady: false,
    mirrors: []
  };
}

export const mirageState = defineProfessionSpecializationState('Mirage', createMirageState);
