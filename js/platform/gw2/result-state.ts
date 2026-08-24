import type { SimulationEvent } from '../engine/types.js';
import type { Gw2ResolverEvent, Gw2SimulationResult } from './types.js';

/**
 * Finds the player strike whose resolved critical chance best represents a
 * requested rotation time, preferring the next eligible strike over the last.
 */
export function criticalChanceEventAt(
  result: Gw2SimulationResult | null | undefined,
  timeMs: number
): Gw2ResolverEvent | null {
  const seconds = Number(timeMs || 0) / 1000;
  let after: Gw2ResolverEvent | null = null;
  let afterAt = Infinity;
  let before: Gw2ResolverEvent | null = null;
  let beforeAt = -Infinity;
  for (const event of result?.resolvedEvents || []) {
    if (event.independentSummonStrike === true) continue;
    if (event.source === 'Clone' || event.source === 'Phantasm') continue;
    // Flat ticks and other non-critical packets report zero chance, which must
    // not replace the player strike being inspected.
    if (event.critEligible === false) continue;
    const chance = Number(event.criticalChance);
    if (!Number.isFinite(chance)) continue;
    const at = Number(event.at || 0);
    if (at >= seconds) {
      if (at < afterAt) {
        afterAt = at;
        after = event;
      }
    } else if (at > beforeAt) {
      beforeAt = at;
      before = event;
    }
  }

  return after ?? before;
}

/** Returns the player critical-strike chance represented at a rotation time. */
export function criticalChanceAt(result: Gw2SimulationResult | null | undefined, timeMs: number): number | null {
  const event = criticalChanceEventAt(result, timeMs);
  return event ? Number(event.criticalChance) : null;
}

/**
 * Returns the latest matching self-buff still active at the requested result
 * time, including its remaining duration and source event.
 */
export function timedBuffAt(
  result: Gw2SimulationResult | null | undefined,
  kind: string,
  atSeconds: number
): { readonly remaining: number; readonly event: SimulationEvent } | null {
  const at = Math.max(0, Number(atSeconds || 0));
  let latest: SimulationEvent | null = null;
  for (const event of result?.events || []) {
    if (Number(event.at || 0) > at) break;
    if (event.type === 'buff' && event.kind === kind) latest = event;
  }

  if (!latest) return null;
  const remaining = Number(latest.at || 0) + Number(latest.duration || 0) - at;
  return remaining > 0 ? { remaining, event: latest } : null;
}

/** Sums every matching timed-buff application still active at a result time. */
export function timedBuffStacksAt(
  result: Gw2SimulationResult | null | undefined,
  kind: string,
  atSeconds: number
): number {
  const at = Math.max(0, Number(atSeconds || 0));
  let stacks = 0;
  for (const event of result?.events || []) {
    if (Number(event.at || 0) > at) break;
    if (event.type !== 'buff' || event.kind !== kind) continue;
    const expiresAt = Number(event.at || 0) + Number(event.duration || 0);
    if (expiresAt > at) stacks += Math.max(1, Number(event.stacks || 1));
  }

  return stacks;
}
