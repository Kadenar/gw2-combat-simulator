/**
 * Core Elementalist prepareEvent hooks: last-chance rewrites applied to outgoing
 * packets before they join the canonical scheduler timeline.
 */
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

// Preserve packets excluded by the configured hitbox as cancelled markers so
// timing and diagnostics remain visible without contributing combat effects.
export function prepareElementalistHitboxEvent(
  context: ElementalistRuntime,
  event: SimulationEventBase
): SimulationEventBase {
  const preparedEvent = event;
  const professionAssumptions = context.config.professionAssumptions || {};
  const hitboxSize = String(professionAssumptions.hitboxSize || context.config.hitboxSize || 'small');

  if (hitboxSize !== 'small') return preparedEvent;

  const hitIndex = preparedEvent.metadata?.hitboxIndex || 0;
  const smallHitboxCap = preparedEvent.metadata?.smallHitboxCap || 0;
  const excluded =
    preparedEvent.metadata?.largeHitboxOnly === true || (smallHitboxCap > 0 && hitIndex > smallHitboxCap);

  if (!excluded) return preparedEvent;

  // Identify each rejected payload so simultaneous strike and condition markers remain distinguishable.
  const effect =
    preparedEvent.type === 'damage'
      ? 'Strike damage'
      : preparedEvent.type === 'condition'
        ? preparedEvent.condition
        : preparedEvent.type;
  return {
    ...preparedEvent,
    type: 'marker',
    name: `${preparedEvent.skillName || preparedEvent.name || 'Elementalist effect'} (${effect}) misses small hitbox`,
    cancelled: true,
    detail: 'excluded by Elementalist target-hitbox rules'
  };
}
