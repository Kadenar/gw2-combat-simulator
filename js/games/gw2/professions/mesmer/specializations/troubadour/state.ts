import type { MesmerConfig } from '#gw2/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';

export interface MesmerTroubadourState {
  numericResource: number;
  instruments: Record<string, number>;
  lastInstrument: string;
}

function createTroubadourState(_config: Partial<MesmerConfig> = {}): MesmerTroubadourState {
  return {
    numericResource: 0,
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
      (event.at === previous.at && Number(event.eventOrder || 0) >= Number(previous.eventOrder || 0))
    )
      latest.set(name, event);
  }

  return new Map(
    [...latest]
      .filter(([, event]) => Number(event.expiresAt) > at)
      .map(([name, event]) => [name, Number(event.expiresAt)])
  );
}
