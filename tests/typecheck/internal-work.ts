import { createInternalWorkFactory } from '#gw2/platform/simulation/internal-work.js';
import { isRuntimeWork, type InternalWork, type RuntimeQueueEntry } from '#gw2/platform/simulation/work-contract.js';
import { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import type { Gw2EventQueue } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';

// Concrete work types retain their payload correlation across the validated creation boundary.
type Work = InternalWork<'complete', { reservationId: string }> | InternalWork<'grant', { amount: number }>;
const handlers = new HandlerRegistry<object, Work>();
const create = createInternalWorkFactory<Work>(handlers);
create({ type: 'complete', at: 0, priority: 0, payload: { reservationId: 'cast:1' } });
create({ type: 'grant', at: 0, priority: 0, payload: { amount: 1 } });
// @ts-expect-error Completion work cannot receive a resource grant payload.
create({ type: 'complete', at: 0, priority: 0, payload: { amount: 1 } });
// @ts-expect-error Unregistered work types are outside this dispatcher union.
create({ type: 'other', at: 0, priority: 0, payload: {} });

// Dequeued entries recover their work payload only after discrimination; packet scheduling stays packet-only.
export function checkQueueBoundary(packets: Gw2EventQueue) {
  const queue = new StableEventQueue<RuntimeQueueEntry>();
  const work = {
    kind: 'internal',
    type: 'runtime.complete',
    at: 1,
    priority: 0,
    payload: { reservationId: 'cast:1' }
  } as const;
  queue.enqueue(work);
  const entry = queue.dequeue();

  if (entry && isRuntimeWork(entry)) {
    if (entry.type === 'runtime.complete') entry.payload.reservationId satisfies string;

    // @ts-expect-error Private work cannot enter packet resolution.
    packets.enqueue(entry);
  } else if (entry) {
    const packet: Gw2ResolverEvent = packets.enqueue(entry);
    packets.cancel(packet);
  }

  // @ts-expect-error Resolver scheduling cannot dispatch the coordinator's heap.
  packets.dequeue();
}
