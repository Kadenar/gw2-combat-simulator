import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { cloneData } from '#kernel/core/clone.js';

/** Clip detached application observations without changing the resolver's natural lifetimes or settlement state. */
export function projectResolvedEvents(events: readonly Gw2ResolverEvent[], end: number): Gw2ResolverEvent[] {
  return cloneData(events).map((event) => {
    if (typeof event.naturalExpiresAt !== 'number') return event;
    const expiresAt = Math.min(
      end,
      event.naturalExpiresAt,
      typeof event.removedAt === 'number' ? event.removedAt : end
    );
    return { ...event, expiresAt, activeDuration: Math.max(0, expiresAt - event.at) };
  });
}
