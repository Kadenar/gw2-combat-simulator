import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Gw2CombatQuery, Gw2QueryRuntime } from '#gw2/platform/combat/query/types.js';

/** Snapshots natural condition duration at application time; each phase owns its stacks and observation window. */
export function conditionApplicationDuration(
  query: Readonly<Gw2CombatQuery>,
  name: string,
  event: SimulationEvent,
  runtime: Gw2QueryRuntime
): number {
  const stats = query.statsAt(event.at, event, runtime);
  const durationMultiplier = event.fixedDuration
    ? 1
    : query.conditionDurationMultiplier(name, event.at, stats, event, runtime);
  const baseDurationMultiplier = event.fixedDuration
    ? 1
    : (query.conditionBaseDurationMultiplier?.(name, event.at, event, runtime) ?? 1);
  return Math.max(0, Number(event.duration || 0)) * baseDurationMultiplier * durationMultiplier;
}
