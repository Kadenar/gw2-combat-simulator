import type { SchedulerRecord, SimulationEventInput } from '#gw2/platform/engine/types.js';
import type { RevenantSchedulerContext } from '#gw2/content/professions/revenant/types.js';

/** Filters packets that only intersect large targets while preserving them as diagnostic markers. */
export function prepareRevenantHitboxEvent(
  context: RevenantSchedulerContext,
  event: SimulationEventInput
): SimulationEventInput {
  const assumptions = (context.config.professionAssumptions || {}) as SchedulerRecord;
  if (String(assumptions.hitboxSize || 'small') === 'large' || event.metadata?.largeHitboxOnly !== true) {
    return event;
  }

  return {
    ...event,
    type: 'marker',
    name: `${String(event.skillName || event.name || 'Revenant effect')} misses small hitbox`,
    cancelled: true,
    detail: 'excluded by Revenant target-hitbox rules',
    revenantHitboxExcluded: true
  };
}
