import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefStruck, venomsConsumed } from '#gw2/professions/thief/core/mechanics/boundaries.js';
import { applyActiveVenoms } from '#gw2/professions/thief/core/mechanics/venoms.js';

/** Landed strikes reach critical and Deadly Arts traits, consume venoms, then reach the aggregate venom traits. */
export function reactThiefCoreDamage(
  runtime: ThiefRuntime,
  event: Gw2ResolverEvent,
  details: Record<string, unknown>
): void {
  runtime.fireTrigger(thiefStruck, { cause: event, details: details });
  // Multiple venom types consume their charges but share one siphon per player strike.
  runtime.fireTrigger(venomsConsumed, { cause: event, consumed: applyActiveVenoms(runtime, event) });
}
