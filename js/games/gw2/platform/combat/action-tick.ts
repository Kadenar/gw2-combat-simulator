import { GW2_TICK_MS, gw2Time } from '#gw2/platform/combat/clock.js';
import { timeKey } from '#kernel/core/clock.js';

/** GW2 action-tick arithmetic: duration ceilings, replay snapping, and absolute next-tick readiness deadlines. */

/** Rounds a positive duration up to the fixed GW2 action tick without admitting an earlier boundary. */
export function quantizeGw2ActionDurationUp(value: number): number {
  if (!(value > 0)) return 0;

  // Integer clock units preserve exact boundaries without admitting an earlier action tick.
  const intervalKey = timeKey(GW2_TICK_MS / 1000);
  return (Math.ceil(timeKey(value / 1000) / intervalKey) * intervalKey) / 1000;
}

/** Snaps observed timing to the nearest GW2 action tick so imported replay values do not retain false precision. */
export function quantizeGw2ActionTimingMs(value: number): number {
  return Math.max(0, Math.round(value / GW2_TICK_MS) * GW2_TICK_MS);
}

/** Cooldowns become usable on the next absolute action tick, including negative precast timestamps. */
export function gw2CooldownReadyAt(at: number): number {
  if (!Number.isFinite(at)) return at;

  return gw2Time(at);
}
