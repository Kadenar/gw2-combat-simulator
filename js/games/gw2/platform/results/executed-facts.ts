import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Gameplay queries retain executed facts in every output mode; only this owner edits action observations. */
export function createExecutedFacts(events: Gw2ResolverEvent[]) {
  return Object.freeze({
    read: (): readonly Readonly<Gw2ResolverEvent>[] => events,
    ofType: (type: string): readonly Readonly<Gw2ResolverEvent>[] => events.filter((event) => event.type === type),
    actionFor: (activationId: unknown): Readonly<Gw2ResolverEvent> | undefined =>
      events.find((event) => event.type === 'action' && event.activationId === activationId),
    record(event: Gw2ResolverEvent): void {
      events.push(event);
    },
    interruptAction(activationId: unknown, at: number): void {
      const action = events.find((event) => event.type === 'action' && event.activationId === activationId);
      if (action && Number(action.fullEndsAt || action.endsAt || 0) > at)
        Object.assign(action, { endsAt: at, interrupted: true });
    }
  });
}
