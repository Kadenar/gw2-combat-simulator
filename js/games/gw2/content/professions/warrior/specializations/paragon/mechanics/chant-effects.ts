import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import { paragonState } from '#gw2/content/professions/warrior/specializations/paragon/state.js';
import type { WarriorResolverContext, WarriorResolverEvent } from '#gw2/content/professions/warrior/types.js';

// Mirrors scheduler-side paragon state into the resolver so modifier rules
// can read motivation and activeRefrain. structuredClone prevents the resolver
// copy from aliasing the scheduler's live state objects.
function handleParagonState(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  const state = paragonState.from(context);
  for (const [key, value] of Object.entries(event.state || {})) {
    (state as unknown as SchedulerRecord)[key] = structuredClone(value);
  }
}

export const paragonResolverEventHandlers = Object.freeze({
  'warrior.paragon-state': handleParagonState
});
