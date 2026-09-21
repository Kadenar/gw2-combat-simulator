import { ACTION_SAFETY_LIMIT } from '#kernel/core/clock.js';
import { createEvent, type SimulationEvent, type SimulationEventInput } from '#gw2/platform/engine/events/events.js';

interface ScheduledEventOptions {
  readonly prepareEvent: (event: SimulationEventInput) => SimulationEventInput;
  readonly observeEvent: (event: SimulationEvent) => void;
  readonly onEventReplaced?: (event: SimulationEvent, replacement: SimulationEvent) => void;
}

/** Owns scheduled event identity and indexes; callbacks observe reentrant emissions in FIFO order. */
export function createScheduledEvents({ prepareEvent, observeEvent, onEventReplaced }: ScheduledEventOptions) {
  const events: SimulationEvent[] = [];
  // Scheduling hooks may emit more events. A FIFO observation queue flattens
  // that recursion so every event is observed exactly once in causal order.
  const observationQueue: SimulationEvent[] = [];
  let observingEvents = false;
  let eventOrder = 0;
  // Derived events share their cause's integer order and use fractional
  // suffixes, keeping them adjacent to the cause at equal timestamps.
  const derivedEventCounts = new Map<number, number>();
  // Shared indexes let scheduler policies and profession hooks query narrow
  // event subsets without repeatedly scanning the complete scheduled stream.
  const eventTypeIndex = new Map<string, SimulationEvent[]>();
  const eventOrderIndex = new Map<number, SimulationEvent>();
  const emptyEventBucket = Object.freeze([]) as readonly SimulationEvent[];
  const indexEvent = (event: SimulationEvent): void => {
    const type = String(event.type || '');
    const bucket = eventTypeIndex.get(type);
    if (bucket) bucket.push(event);
    else eventTypeIndex.set(type, [event]);
    const order = Number(event.eventOrder);
    if (Number.isFinite(order)) eventOrderIndex.set(order, event);
  };

  const replaceIndexedEvent = (event: SimulationEvent, replacement: SimulationEvent): void => {
    const previousType = String(event.type || '');
    const nextType = String(replacement.type || '');
    if (previousType === nextType) {
      const bucket = eventTypeIndex.get(previousType);
      const index = bucket?.indexOf(event) ?? -1;
      if (bucket && index >= 0) bucket[index] = replacement;
    } else {
      // Type-changing replacements are rare; rebuilding the two affected
      // buckets preserves the exact insertion order exposed by context.events.
      eventTypeIndex.set(
        previousType,
        events.filter((candidate) => String(candidate.type || '') === previousType)
      );
      eventTypeIndex.set(
        nextType,
        events.filter((candidate) => String(candidate.type || '') === nextType)
      );
    }

    const order = Number(event.eventOrder);
    if (Number.isFinite(order)) eventOrderIndex.set(order, replacement);
  };

  // Buff events are indexed by lowercased kind so buffStacks/hasBuff scan only
  // the relevant buffs instead of the entire event log on every query.
  const buffIndex = new Map<string, SimulationEvent[]>();
  const buffKindKey = (event: SimulationEvent): string | null =>
    event.type === 'buff' && event.resolvedAudience?.includesSelf ? String(event.kind || '').toLowerCase() : null;
  const indexBuffEvent = (event: SimulationEvent): void => {
    const key = buffKindKey(event);
    if (key == null) return;
    const bucket = buffIndex.get(key);
    if (bucket) bucket.push(event);
    else buffIndex.set(key, [event]);
  };

  const deindexBuffEvent = (event: SimulationEvent): void => {
    const key = buffKindKey(event);
    if (key == null) return;
    const bucket = buffIndex.get(key);
    const at = bucket?.indexOf(event) ?? -1;
    if (bucket && at >= 0) bucket.splice(at, 1);
  };

  const store = {
    events,
    buffEvents(kind: string): readonly SimulationEvent[] {
      return buffIndex.get(kind) || emptyEventBucket;
    },
    eventsOfType(type: string) {
      return eventTypeIndex.get(String(type || '')) || emptyEventBucket;
    },
    eventByOrder(order: number) {
      return eventOrderIndex.get(Number(order));
    },
    emit(event: SimulationEventInput) {
      const normalized = createEvent({
        ...prepareEvent(event),
        eventOrder: eventOrder++
      });
      events.push(normalized);
      indexEvent(normalized);
      indexBuffEvent(normalized);
      observationQueue.push(normalized);
      if (!observingEvents) {
        let observationCount = 0;
        observingEvents = true;
        try {
          while (observationQueue.length) {
            if (++observationCount > ACTION_SAFETY_LIMIT) {
              throw new Error('Scheduled-event observation safety limit exceeded.');
            }

            const observed = observationQueue.shift();
            if (observed) {
              observeEvent(observed);
            }
          }
        } finally {
          observingEvents = false;
        }
      }

      return normalized;
    },
    replaceEvent(event: SimulationEvent, updates: Partial<SimulationEventInput>) {
      // Hooks may retain older references; always merge into the current version of this identity.
      const current = store.eventByOrder(Number(event.eventOrder));
      if (!current) throw new TypeError('Event replacement requires a scheduled event.');
      if (Object.hasOwn(updates, 'eventOrder') && updates.eventOrder !== current.eventOrder) {
        throw new TypeError('Event replacement cannot change eventOrder.');
      }

      event = current;
      const replacement = createEvent({ ...event, ...updates });
      const replaceReference = (collection: SimulationEvent[]): void => {
        const index = collection.indexOf(event);
        if (index >= 0) collection[index] = replacement;
      };

      deindexBuffEvent(event);
      replaceReference(events);
      replaceReference(observationQueue);
      replaceIndexedEvent(event, replacement);
      indexBuffEvent(replacement);
      onEventReplaced?.(event, replacement);
      return replacement;
    },
    emitDerived(cause: SimulationEvent, event: SimulationEventInput) {
      const rootOrder = Math.floor(Number(cause?.causalOrder ?? cause?.eventOrder));
      if (!Number.isFinite(rootOrder)) {
        throw new TypeError('Derived events require a scheduled cause.');
      }

      const count = (derivedEventCounts.get(rootOrder) || 0) + 1;
      derivedEventCounts.set(rootOrder, count);
      return store.emit({
        ...(cause.activationId ? { activationId: cause.activationId } : {}),
        ...event,
        causalOrder: rootOrder + count / 1_000_000,
        triggeredBy: event.triggeredBy ?? cause.skillName ?? cause.name ?? ''
      });
    }
  };
  return store;
}
