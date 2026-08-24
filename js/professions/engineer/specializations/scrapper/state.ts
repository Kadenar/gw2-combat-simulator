import type { ScrapperState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';

export function createScrapperState(): ScrapperState {
  return {
    kineticAcceleratorsWhirlReadyAt: 0
  };
}

export const scrapperState = defineProfessionSpecializationState('Scrapper', createScrapperState);
