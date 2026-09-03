import type { ScrapperState } from '#gw2/professions/engineer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

/** Creates Scrapper's whirl-only Kinetic Accelerators cooldown state. */
export function createScrapperState(): ScrapperState {
  return {
    kineticAcceleratorsWhirlReadyAt: 0
  };
}

export const scrapperState = defineProfessionSpecializationState('Scrapper', createScrapperState);
