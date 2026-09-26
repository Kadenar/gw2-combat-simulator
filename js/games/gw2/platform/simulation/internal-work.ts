import { canonicalTime } from '#kernel/core/clock.js';
import type { QueuedEvent } from '#kernel/events/queue.js';
import type { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';

/** A lifetime is separate from cast attribution: committed projectiles can outlive their originating cast. */
export interface WorkOwner {
  readonly id: string;
  readonly generation: number;
}

/** Concrete handlers specialize type and payload into a discriminated union; internal work is never a log packet. */
export interface InternalWork<TType extends string = string, TPayload = unknown> extends QueuedEvent {
  readonly kind: 'internal';
  readonly id: number;
  readonly type: TType;
  readonly at: number;
  readonly priority: number;
  readonly payload: TPayload;
  readonly activationId?: string;
  readonly owner?: WorkOwner;
}

type WorkInput<TWork extends InternalWork> = TWork extends InternalWork
  ? Pick<TWork, 'type' | 'at' | 'priority' | 'payload' | 'activationId' | 'owner' | 'causalOrder'>
  : never;

/** Validate and detach work before it enters the shared heap; callbacks stay in the existing handler registry. */
export function createInternalWorkFactory<TWork extends InternalWork>(
  handlers: Pick<HandlerRegistry<unknown, TWork>, 'has'>
): (input: WorkInput<TWork>) => TWork {
  let sequence = 0;
  return (input) => {
    if (!handlers.has(input.type)) throw new TypeError(`No internal work handler registered for ${input.type}.`);
    const at = canonicalTime(input.at);
    if (!Number.isFinite(input.priority)) throw new RangeError('Internal work priority must be finite.');
    if (input.activationId != null && (typeof input.activationId !== 'string' || !input.activationId)) {
      throw new TypeError('Internal work activation id must be a nonempty string.');
    }

    if (input.causalOrder != null && !Number.isFinite(input.causalOrder)) {
      throw new RangeError('Internal work causal order must be finite.');
    }

    if (
      input.owner &&
      (typeof input.owner.id !== 'string' ||
        !input.owner.id ||
        !Number.isSafeInteger(input.owner.generation) ||
        input.owner.generation < 0)
    ) {
      throw new TypeError('Internal work requires an owner id and a nonnegative safe integer generation.');
    }

    let payload: unknown;
    try {
      payload = structuredClone(input.payload);
    } catch {
      throw new TypeError(`Internal work ${input.type} payload must contain only serializable data.`);
    }

    return Object.freeze({
      kind: 'internal',
      id: ++sequence,
      type: input.type,
      at,
      priority: input.priority,
      payload,
      ...(input.activationId == null ? {} : { activationId: input.activationId }),
      ...(input.causalOrder == null ? {} : { causalOrder: input.causalOrder }),
      ...(input.owner ? { owner: Object.freeze({ ...input.owner }) } : {})
    }) as unknown as TWork;
  };
}
