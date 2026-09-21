import { cappedResource } from '#gw2/platform/combat/resources/pool.js';

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

/** Credits all discrete grants while continuing the cadence at the cap. */
export function advanceDiscreteResource(
  value: number,
  maximum: number,
  nextAt: number,
  interval: number,
  target: number
) {
  if (!(interval > 0) || !Number.isFinite(interval))
    throw new TypeError('Resource intervals must be finite and positive.');
  const count = nextAt <= target ? Math.floor((target - nextAt) / interval) + 1 : 0;
  return { value: cappedResource(value + count, maximum), nextAt: nextAt + count * interval };
}

/** Carries partial discrete recharge through explicit rate windows, even while the resource is capped. */
export function advanceResourceRecharge(
  value: number,
  maximum: number,
  progress: number,
  period: number,
  intervals: Iterable<{ readonly start: number; readonly end: number; readonly rate: number }>,
  tolerance = 0
): { value: number; progress: number } {
  if (!(period > 0) || !Number.isFinite(period))
    throw new TypeError('Resource recharge periods must be finite and positive.');
  for (const interval of intervals) progress += (interval.end - interval.start) * interval.rate;
  const generated = Math.floor((progress + tolerance) / period);
  return { value: cappedResource(value + generated, maximum), progress: Math.max(0, progress - generated * period) };
}
