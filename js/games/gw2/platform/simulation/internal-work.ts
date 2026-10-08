import type { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';
import type { InternalWork, WorkInput } from '#gw2/platform/simulation/work-contract.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { cloneData } from '#kernel/core/clone.js';

/** Validate and detach work before it enters the shared heap; callbacks stay in the existing handler registry. */
export function createInternalWorkFactory<TWork extends InternalWork>(
  handlers: Pick<HandlerRegistry<unknown, TWork>, 'has'>
): (input: WorkInput<TWork>) => TWork {
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
      payload = cloneData(input.payload);
    } catch {
      throw new TypeError(`Internal work ${input.type} payload must contain only serializable data.`);
    }

    return Object.freeze({
      kind: 'internal',
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
