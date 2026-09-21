import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import {
  type Gw2TimedBuffApplication,
  boonApplicationsAt,
  buffApplicationStacks,
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  isDurationStackingBoon,
  isStandardBoon,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/boons.js';

interface ResultEffectIndex {
  readonly byKind: Map<string, SimulationEvent[]>;
  readonly extensions: SimulationEvent[];
}

const effectIndexes = new WeakMap<readonly Gw2ResolverEvent[], ResultEffectIndex>();

/** Completed results retain one index of committed effects; scheduled predictions never become report facts. */
function resultEffects(result: Gw2SimulationResult | null | undefined, kind: string) {
  const events = result?.resolvedEvents;
  if (!events) return { buffs: [], extensions: [] };
  let index = effectIndexes.get(events);
  if (!index) {
    index = { byKind: new Map(), extensions: [] };
    for (const event of events) {
      if (event.type === 'boon_extension') index.extensions.push(event);
      if (event.type !== 'buff') continue;
      const key = String(event.kind || '').toLowerCase();
      const bucket = index.byKind.get(key) || [];
      bucket.push(event);
      index.byKind.set(key, bucket);
    }

    effectIndexes.set(events, index);
  }

  return { buffs: index.byKind.get(kind) || [], extensions: index.extensions };
}

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

/**
 * Returns the latest matching self-buff still active at the requested result
 * time, including its remaining duration and source event.
 */
export function timedBuffAt(
  result: Gw2SimulationResult | null | undefined,
  kind: string,
  atSeconds: number
): { readonly remaining: number; readonly event: SimulationEvent } | null {
  const at = canonicalTime(Math.max(0, Number(atSeconds || 0)));
  kind = String(kind).toLowerCase();
  const { buffs, extensions } = resultEffects(result, kind);
  const applications = extensions.length ? boonApplicationsAt([...buffs, ...extensions], kind, at) : buffs;
  const live = applications.filter((event) => buffMatchesAudience(event, 'all') && event.at <= at);
  if (isDurationStackingBoon(kind)) {
    const remaining = remainingDurationStackSeconds(live, at, { maximum: durationStackingBoonCapSeconds(kind) });
    const event = buffs.filter((event) => event.at <= at && buffMatchesAudience(event, 'all')).at(-1);
    return remaining > 0 && event ? { remaining, event } : null;
  }

  // Test each source's surviving applications so extensions retain the original buff identity.
  for (let index = buffs.length - 1; index >= 0; index -= 1) {
    const event = buffs[index];
    if (event.at > at || !buffMatchesAudience(event, 'all')) continue;
    const applications =
      extensions.length && isStandardBoon(kind) ? boonApplicationsAt([event, ...extensions], kind, at) : [event];
    const application = applications
      .filter(
        (application) =>
          buffMatchesAudience(application, 'all') &&
          isTimeInWindow(
            at,
            application.at,
            'expiresAt' in application
              ? Number(application.expiresAt)
              : gw2EffectExpiresAt(application.at, Number(application.duration || 0))
          )
      )
      .at(-1);
    if (!application) continue;
    const expiresAt =
      'expiresAt' in application
        ? Number(application.expiresAt)
        : gw2EffectExpiresAt(application.at, Number(application.duration || 0));
    return { remaining: expiresAt - at, event };
  }

  return null;
}

/** Sums every matching timed-buff application still active at a result time. */
export function timedBuffStacksAt(
  result: Gw2SimulationResult | null | undefined,
  kind: string,
  atSeconds: number
): number {
  const at = canonicalTime(Math.max(0, Number(atSeconds || 0)));
  kind = String(kind).toLowerCase();
  const { buffs, extensions } = resultEffects(result, kind);
  const applications = extensions.length ? boonApplicationsAt([...buffs, ...extensions], kind, at) : buffs;
  return buffApplicationStacks<SimulationEvent | Gw2TimedBuffApplication>(applications, kind, at, Infinity);
}
