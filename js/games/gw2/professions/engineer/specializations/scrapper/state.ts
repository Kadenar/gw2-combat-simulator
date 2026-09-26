import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export interface ScrapperState {
  massMomentumAt: number;
  kineticAcceleratorsWhirlReadyAt: number;
}

/** Creates Scrapper's whirl-only Kinetic Accelerators cooldown state. */
export function createScrapperState(): ScrapperState {
  return {
    massMomentumAt: Infinity,
    kineticAcceleratorsWhirlReadyAt: 0
  };
}

export const scrapperState = defineProfessionSpecializationState('Scrapper', createScrapperState);
