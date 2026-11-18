import { gw2Time } from '#gw2/platform/combat/clock.js';
import type { InternalWork, WorkInput } from '#gw2/platform/simulation/work-contract.js';
import { cloneData } from '#kernel/core/clone.js';
import type { HandlerRegistry } from '#kernel/events/handler-registry.js';

/** Validate and detach work before it enters the shared heap; callbacks stay in the existing handler registry. */
export function createInternalWorkFactory<TWork extends InternalWork>(
  handlers: Pick<HandlerRegistry<unknown, TWork>, 'has'>
): (input: WorkInput<TWork>) => TWork {
  return (input) => {
    if (!handlers.has(input.type)) throw new TypeError(`No internal work handler registered for ${input.type}.`);

    const at = gw2Time(input.at);

    if (!Number.isFinite(at)) throw new RangeError('Internal work time must be finite.');

    if (!Number.isFinite(input.priority)) throw new RangeError('Internal work priority must be finite.');

    // Named tasks may grant before gameplay or clean up afterward; completions keep their causal position.
    const timing: unknown = input.timing;

    if (
      timing != null &&
      (!['buffs', 'expiry'].includes(String(timing)) ||
        (input.type !== 'runtime.task' && input.type !== 'runtime.cast-task'))
    )
      throw new TypeError('Task timing requires a named task.');

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
      ...(input.timing == null ? {} : { timing: input.timing }),
      payload,
      ...(input.activationId == null ? {} : { activationId: input.activationId }),
      ...(input.causalOrder == null ? {} : { causalOrder: input.causalOrder }),
      ...(input.owner ? { owner: Object.freeze({ ...input.owner }) } : {})
    }) as unknown as TWork;
  };
}
