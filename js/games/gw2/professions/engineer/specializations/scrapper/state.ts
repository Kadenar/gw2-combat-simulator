import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

export interface ScrapperState {
  massMomentumAt: number;
}

/** Creates Scrapper's pending Mass Momentum pulse state. */
export function createScrapperState(): ScrapperState {
  return {
    massMomentumAt: Infinity
  };
}

export const scrapperState = defineProfessionSpecializationState('Scrapper', createScrapperState);
