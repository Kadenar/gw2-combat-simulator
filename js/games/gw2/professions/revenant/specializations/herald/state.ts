import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

export interface HeraldState {
  /** The one scheduled Elevated Compassion pulse; stale or cancelled cadences no longer match it. */
  elevatedCompassionPulseAt: number | null;

  /** Consumed passives retain their window and legend without retaining upkeep drain. */
  lingeringFacets: Record<string, { startsAt: number; expiresAt: number; legendId: string }>;
  facetPulseReadyAt: Record<string, number>;
}

// Own facet pulse readiness, retained passives, and the pending Elevated Compassion pulse.
export function createHeraldState(): HeraldState {
  return {
    elevatedCompassionPulseAt: null,

    lingeringFacets: {},
    facetPulseReadyAt: {}
  };
}

// Herald's slice of the single live runtime state.
export const heraldState = defineProfessionSpecializationState('Herald', createHeraldState);
