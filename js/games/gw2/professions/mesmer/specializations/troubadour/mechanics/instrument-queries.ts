import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { activeTroubadourInstrumentsAt } from '#gw2/professions/mesmer/specializations/troubadour/state.js';

/** Share the scheduler's exact instrument replacement and expiry policy with modifier queries. */
const EMPTY_EVENTS: readonly SimulationEvent[] = Object.freeze([]);

function instrumentEvents(context: Gw2ModifierContext): readonly SimulationEvent[] {
  return context.events?.filter((event) => event.type === 'mesmer.instrument') ?? EMPTY_EVENTS;
}

function instrumentChecksEnabled(context: Gw2ModifierContext): boolean {
  const specialization = context.config?.specialization;
  return !specialization || specialization === 'Troubadour';
}

export function activeInstrumentCount(context: Gw2ModifierContext): number {
  if (!instrumentChecksEnabled(context)) return 0;
  return activeTroubadourInstrumentsAt(instrumentEvents(context), context.time, context.event).size;
}

export function hasLute(context: Gw2ModifierContext): boolean {
  if (!instrumentChecksEnabled(context)) return false;
  return activeTroubadourInstrumentsAt(instrumentEvents(context), context.time, context.event).has('Lute');
}
