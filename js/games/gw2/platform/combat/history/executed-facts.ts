import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Queries observe executed gameplay in every output mode without acquiring its recording capability. */
export interface ExecutedFactsReader {
  read(): readonly Readonly<Gw2ResolverEvent>[];
  ofType(type: string): readonly Readonly<Gw2ResolverEvent>[];
  actionFor(activationId: unknown): Readonly<Gw2ResolverEvent> | undefined;
}

/** Delivery and registered mechanic handlers record facts through the store's explicit mutation boundary. */
export interface ExecutedFactsWriter {
  record(event: Gw2ResolverEvent): void;
  interruptAction(activationId: unknown, at: number): void;
}

/** The store owns the shared history; composition grants readers and writers independently. */
export function createExecutedFacts(events: Gw2ResolverEvent[]) {
  const reader: ExecutedFactsReader = Object.freeze({
    read: (): readonly Readonly<Gw2ResolverEvent>[] => events,
    ofType: (type: string): readonly Readonly<Gw2ResolverEvent>[] => events.filter((event) => event.type === type),
    actionFor: (activationId: unknown): Readonly<Gw2ResolverEvent> | undefined =>
      events.find((event) => event.type === 'action' && event.activationId === activationId)
  });
  const writer: ExecutedFactsWriter = Object.freeze({
    record(event: Gw2ResolverEvent): void {
      events.push(event);
    },
    interruptAction(activationId: unknown, at: number): void {
      const action = events.find((event) => event.type === 'action' && event.activationId === activationId);
      if (action && Number(action.fullEndsAt || action.endsAt || 0) > at)
        Object.assign(action, { endsAt: at, interrupted: true });
    }
  });
  return Object.freeze({ reader, writer });
}
