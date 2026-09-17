import type { SimulationEventInput } from '#gw2/platform/engine/events/events.js';
import type { RevenantSchedulerContext } from '#gw2/professions/revenant/types.js';

/** Filters packets that only intersect large targets while preserving them as diagnostic markers. */
export function prepareRevenantHitboxEvent(
  context: RevenantSchedulerContext,
  event: SimulationEventInput
): SimulationEventInput {
  const assumptions = context.config.professionAssumptions || {};
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
