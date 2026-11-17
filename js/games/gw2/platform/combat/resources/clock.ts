/** GW2 combines continuous accrual with discrete grants and action-tick readiness detection. */
import { GW2_ACTION_TICK_MS, gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { timeKey } from '#kernel/core/clock.js';
import {
  createResourceClock,
  resourceThresholdAt,
  resourceValueAt,
  type ResourceClock
} from '#kernel/resources/accrual.js';
import { cappedResource, resourceAtLeast } from '#kernel/resources/pool.js';

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

export interface DiscreteResourceClock extends ResourceClock {
  interval: number;
  unitsPerTick: number;
  nextAt: number;
}

export function createDiscreteResourceClock(value = 0): DiscreteResourceClock {
  return { ...createResourceClock(value), interval: 0, unitsPerTick: 1, nextAt: Infinity };
}

/** Project discrete balance and phase together; continuous reads keep their fixed anchor without allocating a result. */
function resourceProjectionAt(state: DiscreteResourceClock, at: number): { value: number; nextAt: number };
function resourceProjectionAt(state: ResourceClock, at: number): number | { value: number; nextAt: number };
function resourceProjectionAt(state: ResourceClock, at: number): number | { value: number; nextAt: number } {
  if (at < state.updatedAt || !Number.isFinite(at))
    throw new RangeError('Resource time must be finite and nondecreasing.');

  if ('nextAt' in state) {
    const discrete = state as DiscreteResourceClock;

    if (!(discrete.interval > 0)) return { value: state.value, nextAt: discrete.nextAt };

    const projection = advanceDiscreteResource(0, Infinity, discrete.nextAt, discrete.interval, at);
    projection.value = Math.min(state.maximum, state.value + projection.value * discrete.unitsPerTick);
    return projection;
  }

  return resourceValueAt(state, at);
}

/** Reads preserve continuous anchors so partitioning an observation cannot shift threshold detection. */
export function resourceAt(state: ResourceClock, at: number): number {
  const projection = resourceProjectionAt(state, at);
  return typeof projection === 'number' ? projection : projection.value;
}

/** Settle the old segment before a mutation, keeping discrete phase even when grants overflow. */
export function advanceResource(state: ResourceClock, at: number): void {
  const projection = resourceProjectionAt(state, at);

  if (typeof projection !== 'number') (state as DiscreteResourceClock).nextAt = projection.nextAt;

  state.value = typeof projection === 'number' ? projection : projection.value;
  state.updatedAt = at;
}

/** Pure pool affordability shared by command execution and live resource policies. */
export function resourceRecoveryReadyAt(state: ResourceClock, cost: number, at: number): number | null {
  let readyAt = Infinity;

  if (!('nextAt' in state)) {
    const threshold = resourceThresholdAt(state, cost, at);

    if (threshold == null) return null;

    if (threshold.funding === 'existing') return threshold.at;

    readyAt = gw2CooldownReadyAt(threshold.at);

    // Completed recovery can be observed off-grid; a pending cost must still wait for a future detection tick.
    if (threshold.funding === 'recovered') return Math.max(at, readyAt);
  } else {
    if (!Number.isFinite(cost) || cost < 0) throw new RangeError('Resource cost must be finite and non-negative.');

    const discrete = state as DiscreteResourceClock;
    const projection = resourceProjectionAt(discrete, at);
    const value = projection.value;

    if (resourceAtLeast(value, cost)) return at;

    if (cost > state.maximum) return null;

    if (discrete.interval > 0 && discrete.unitsPerTick > 0 && Number.isFinite(discrete.nextAt)) {
      readyAt = gw2CooldownReadyAt(
        projection.nextAt + (Math.ceil((cost - value) / discrete.unitsPerTick) - 1) * discrete.interval
      );
    }
  }

  if (!Number.isFinite(readyAt)) return null;

  // A rounded recovery forecast must remain future while the current balance is still below the cost.
  return readyAt <= at ? gw2CooldownReadyAt(at + GW2_ACTION_TICK_MS / 1000) : readyAt;
}
