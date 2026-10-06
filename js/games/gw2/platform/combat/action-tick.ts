import { canonicalTime, timeKey } from '#kernel/core/clock.js';

/** GW2 action-tick arithmetic: duration ceilings, replay snapping, and absolute next-tick readiness deadlines. */

/** GW2 completes calculated cast durations on 40 ms action-tick boundaries. */
export const GW2_ACTION_TICK_MS = 40;

/** Rounds a positive duration up to the next server/action interval. */
export function quantizeGw2ActionDurationUp(value: number, interval = GW2_ACTION_TICK_MS): number {
  if (!(value > 0)) return 0;
  // The epsilon keeps an exact boundary from rounding into the next action tick.
  return Math.ceil(value / interval - 1e-9) * interval;
}

/** Snaps observed timing to the nearest GW2 action tick so imported replay values do not retain false precision. */
export function quantizeGw2ActionTimingMs(value: number): number {
  return Math.max(0, Math.round(value / GW2_ACTION_TICK_MS) * GW2_ACTION_TICK_MS);
}

/** Cooldowns become usable on the next absolute action tick, including negative precast timestamps. */
export function gw2CooldownReadyAt(at: number): number {
  if (!Number.isFinite(at)) return at;
  return canonicalTime((Math.ceil(timeKey(at) / (GW2_ACTION_TICK_MS * 1000)) * GW2_ACTION_TICK_MS) / 1000);
}
