import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export interface HeraldState {
  elevatedCompassionReadyAt: number;
  sharedEmpowermentReadyAt: number;
  /** Consumed passives retain their window and legend without retaining upkeep drain. */
  lingeringFacets: Record<string, { startsAt: number; expiresAt: number; legendId: string }>;
  facetPulseReadyAt: Record<string, number>;
  /** Resolver-owned life-steal cooldown; scheduler snapshots must not rewind it. */
  natureSiphonReadyAt: number;
}

// Keep Herald ICDs private so threshold re-entry and rapid boon packets cannot reset either trait's cadence.
export function createHeraldState(): HeraldState {
  return {
    elevatedCompassionReadyAt: 0,
    sharedEmpowermentReadyAt: 0,
    lingeringFacets: {},
    facetPulseReadyAt: {},
    natureSiphonReadyAt: 0
  };
}

// Each phase owns its state; snapshot restoration preserves the resolver's Nature siphon clock.
export const heraldState = defineProfessionSpecializationState('Herald', createHeraldState);
