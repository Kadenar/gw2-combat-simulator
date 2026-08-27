import type { SchedulerRecord, SimulationEventInput } from '../../../platform/engine/types.js';
import type { ElementalistSchedulerContext } from '../types.js';

// Preserve packets excluded by the configured hitbox as cancelled markers so
// timing and diagnostics remain visible without contributing combat effects.
export function prepareElementalistHitboxEvent(
  context: ElementalistSchedulerContext,
  event: SimulationEventInput
): SimulationEventInput {
  const preparedEvent = event;
  const professionAssumptions = (context.config.professionAssumptions || {}) as SchedulerRecord;
  const hitboxSize = String(professionAssumptions.hitboxSize || context.config.hitboxSize || 'small');

  if (hitboxSize !== 'small') return preparedEvent;
  const hitIndex = Number(preparedEvent.hitboxIndex || 0);
  const smallHitboxCap = Number(preparedEvent.smallHitboxCap || 0);
  const excluded = preparedEvent.largeHitboxOnly === true || (smallHitboxCap > 0 && hitIndex > smallHitboxCap);

  if (!excluded) return preparedEvent;
  return {
    ...preparedEvent,
    type: 'marker',
    name: `${String(preparedEvent.skillName || preparedEvent.name || 'Elementalist effect')} misses small hitbox`,
    cancelled: true,
    detail: 'excluded by Elementalist target-hitbox rules',
    elementalistHitboxExcluded: true
  };
}
