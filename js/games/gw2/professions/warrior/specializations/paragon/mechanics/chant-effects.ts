import type { ParagonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { WarriorResolverContext, WarriorResolverEvent } from '#gw2/professions/warrior/types.js';

// Mirrors scheduler-side paragon state into the resolver so modifier rules
// can read motivation and refrain identity. The refrain name is only used for display.
// structuredClone prevents the resolver
// copy from aliasing the scheduler's live state objects.
function handleParagonState(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  const state = paragonState.from(context);
  for (const [key, value] of Object.entries(event.state || {}) as Array<
    [keyof ParagonState | 'activeRefrain', ParagonState[keyof ParagonState]]
  >) {
    if (key === 'activeRefrain') continue;
    // Object.entries loses the key/value relationship of the scheduler's Paragon state projection.
    (state as { [Key in keyof ParagonState]: ParagonState[keyof ParagonState] })[key] = structuredClone(value);
  }
}

export const paragonResolverEventHandlers = Object.freeze({
  'warrior.paragon-state': handleParagonState
});
