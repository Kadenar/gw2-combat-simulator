import type { SimulationEventBase } from '#gw2/platform/events/events.js';

/** Count each emission once per report row, even when it expands into sibling effects or condition stacks. */
export function countProcActivations<T extends SimulationEventBase>(
  events: readonly T[],
  rowKey: (event: T) => string | undefined
): Map<string, number> {
  const activations = new Map<string, Map<string, number>>();
  for (const event of events) {
    const activation = event.procActivation;

    if (!activation || event.cancelled === true) continue;

    const key = rowKey(event);

    if (key == null) continue;

    const row = activations.get(key) ?? new Map<string, number>();
    row.set(activation.id, activation.count);
    activations.set(key, row);
  }

  return new Map([...activations].map(([key, row]) => [key, [...row.values()].reduce((sum, count) => sum + count, 0)]));
}
