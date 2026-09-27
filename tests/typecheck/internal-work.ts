import { createInternalWorkFactory, type InternalWork } from '#gw2/platform/simulation/internal-work.js';
import { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';

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
