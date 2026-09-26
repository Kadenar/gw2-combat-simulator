import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export interface HeraldState {
  elevatedCompassionReadyAt: number;
  /** The one scheduled Elevated Compassion pulse; stale or cancelled cadences no longer match it. */
  elevatedCompassionPulseAt: number | null;
  sharedEmpowermentReadyAt: number;
  /** Consumed passives retain their window and legend without retaining upkeep drain. */
  lingeringFacets: Record<string, { startsAt: number; expiresAt: number; legendId: string }>;
  facetPulseReadyAt: Record<string, number>;
  /** Assassin Nature's life-steal cooldown, claimed when a landed strike resolves. */
  natureSiphonReadyAt: number;
}

// Keep Herald ICDs private so threshold re-entry and rapid boon packets cannot reset either trait's cadence.
export function createHeraldState(): HeraldState {
  return {
    elevatedCompassionReadyAt: 0,
    elevatedCompassionPulseAt: null,
    sharedEmpowermentReadyAt: 0,
    lingeringFacets: {},
    facetPulseReadyAt: {},
    natureSiphonReadyAt: 0
  };
}

// Herald's slice of the single live runtime state.
export const heraldState = defineProfessionSpecializationState('Herald', createHeraldState);
