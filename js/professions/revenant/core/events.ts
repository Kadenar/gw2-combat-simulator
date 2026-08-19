import { professionCoreState } from '../../../platform/engine/profession.js';
import type { SchedulerRecord, SimulationEventInput } from '../../../platform/engine/types.js';
import type { RevenantResolverContext, RevenantResolverEvent, RevenantSchedulerContext } from '../types.js';

/** Filters packets that only intersect large targets while preserving them as diagnostic markers. */
export function prepareRevenantHitboxEvent(
  context: RevenantSchedulerContext,
  event: SimulationEventInput
): SimulationEventInput {
  const assumptions = (context.config.professionAssumptions || {}) as SchedulerRecord;
  if (String(assumptions.hitboxSize || 'small') === 'large' || event.largeHitboxOnly !== true) {
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

export function handleRevenantState(context: RevenantResolverContext, event: RevenantResolverEvent): void {
  const core = professionCoreState(context);
  const specialization = context.profession.specialization.state;
  const preserved = {
    traitProcReadyAt: core.traitProcReadyAt || {}
  };
  for (const [key, value] of Object.entries(event.state || {})) {
    const owner = Object.hasOwn(specialization, key) ? specialization : core;
    (owner as Record<string, unknown>)[key] = structuredClone(value);
  }

  Object.assign(core, preserved);
}
