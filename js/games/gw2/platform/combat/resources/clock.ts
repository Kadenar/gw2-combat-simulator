import { cappedResource } from '#gw2/platform/combat/resources/pool.js';
import { timeKey } from '#kernel/core/clock.js';
import { GW2_ACTION_TICK_MS } from '#gw2/platform/skills/timing.js';

export interface ResourceClock {
  value: number;
  maximum: number;
  updatedAt: number;
  rate: number;
}

/** Queries a fixed accrual anchor without accumulating rounding from intermediate observations. */
export function resourceValueAt(clock: ResourceClock, at: number): number {
  return cappedResource(clock.value + (at - clock.updatedAt) * clock.rate, clock.maximum);
}

/** Accrues the previous rate before a gain, spend, or rate change; fractional progress survives every boundary. */
export function advanceResourceClock(clock: ResourceClock, at: number): void {
  if (!Number.isFinite(at) || at < clock.updatedAt)
    throw new RangeError('Resource clocks must advance to a finite, nondecreasing time.');
  clock.value = resourceValueAt(clock, at);
  clock.updatedAt = at;
}

/** Changes a rate only after settling its previous interval. */
export function setResourceRate(clock: ResourceClock, at: number, rate: number): void {
  if (!Number.isFinite(rate)) throw new TypeError('Resource rates must be finite.');
  advanceResourceClock(clock, at);
  clock.rate = rate;
}

/** Returns the next zero crossing; a non-draining resource has no depletion deadline. */
export function resourceDepletionAt(clock: ResourceClock): number {
  return clock.rate < 0 ? clock.updatedAt + clock.value / -clock.rate : Infinity;
}

/** Credits grants on the first 40 ms tick at or after their deadline, preserving cadence even at the cap. */
export function advanceDiscreteResource(
  value: number,
  maximum: number,
  nextAt: number,
  interval: number,
  target: number
) {
  if (!(interval > 0) || !Number.isFinite(interval))
    throw new TypeError('Resource intervals must be finite and positive.');
  if (nextAt === Infinity) return { value: cappedResource(value, maximum), nextAt };
  const period = timeKey(interval);
  if (period <= 0) throw new RangeError('Resource intervals must span at least one clock unit.');
  const tick = GW2_ACTION_TICK_MS * 1000;
  const through = Math.floor(timeKey(target) / tick) * tick;
  const next = timeKey(nextAt);
  const count = Math.max(0, Math.floor((through - next) / period) + 1);
  return { value: cappedResource(value + count, maximum), nextAt: (next + count * period) / 1_000_000 };
}
