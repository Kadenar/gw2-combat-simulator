import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import { createResourceClock } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

export interface MesmerTroubadourState {
  notes: ResourceClock;
  endurance: number;
  enduranceUpdatedAt: number;
  instruments: Record<string, number>;
  lastInstrument: string;
}

/** Starts Troubadour resources with no instrument performance carried into the simulation. */
function createTroubadourState(): MesmerTroubadourState {
  return {
    notes: createResourceClock(),
    endurance: 100,
    enduranceUpdatedAt: 0,
    instruments: {},
    lastInstrument: ''
  };
}

export const troubadourState = defineProfessionSpecializationState('Troubadour', createTroubadourState);

/** Replays the latest committed window per instrument, so shorter replacements cannot revive older performances. */
export function activeTroubadourInstrumentsAt(
  events: readonly SimulationEvent[],
  at: number,
  currentEvent?: SimulationEvent | null
): Map<string, number> {
  at = canonicalTime(at);
  const latest = new Map<string, SimulationEvent>();
  for (const event of events) {
    if (event.type !== 'mesmer.instrument' || event.at > at) continue;
    // A same-time performance cannot affect an event that preceded its commitment.
    if (event.at === at && Number(event.eventOrder) > Number(currentEvent?.eventOrder)) continue;
    const name = String(event.instrument);
    const previous = latest.get(name);
    if (
      !previous ||
      event.at > previous.at ||
      (event.at === previous.at && (event.eventOrder || 0) >= (previous.eventOrder || 0))
    )
      latest.set(name, event);
  }

  return new Map(
    [...latest]
      .filter(([, event]) => Number(event.expiresAt) > at)
      .map(([name, event]) => [name, Number(event.expiresAt)])
  );
}

/** Publishes this module's detached public observations at the planning boundary. */
export function projectTroubadourPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as MesmerTroubadourState;
  const at = canonicalTime(input.time);
  return {
    notes: state.notes,
    endurance: state.endurance,
    activeInstruments: Object.entries(state.instruments)
      .filter(([, expiresAt]) => expiresAt > at)
      .map(([name, expiresAt]) => ({
        name,
        expiresAt: Math.round(expiresAt * 1000),
        remaining: Math.max(0, Math.round((expiresAt - at) * 1000))
      }))
  };
}
