import type { ScrapperState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../../platform/engine/profession/state.js';

// Only whirl finishers share Kinetic Accelerators' ICD; blast and leap combos
// deliberately bypass this timestamp and can proc on every successful combo.
export function createScrapperState(): ScrapperState {
  return {
    kineticAcceleratorsWhirlReadyAt: 0
  };
}

export const scrapperState = defineProfessionSpecializationState('Scrapper', createScrapperState);
