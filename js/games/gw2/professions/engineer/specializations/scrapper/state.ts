import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

export interface ScrapperState {
  massMomentumAt: number;
}

/** Creates Scrapper's whirl-only Kinetic Accelerators cooldown state. */
export function createScrapperState(): ScrapperState {
  return {
    massMomentumAt: Infinity
  };
}

export const scrapperState = defineProfessionSpecializationState('Scrapper', createScrapperState);
