import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

export interface MesmerTroubadourState {
  numericResource: number;
  endurance: number;
  enduranceUpdatedAt: number;
  instruments: Record<string, number>;
  lastInstrument: string;
}

/** Starts Troubadour resources with no instrument performance carried into the simulation. */
function createTroubadourState(): MesmerTroubadourState {
  return {
    numericResource: 0,
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
    resource: state.numericResource,
    resourceDefinition: mesmerResourceDefinition('Troubadour', { catalog: input.catalog }),
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
