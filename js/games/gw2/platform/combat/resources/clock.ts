import { cappedResource, resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { timeKey } from '#kernel/core/clock.js';
import { GW2_ACTION_TICK_MS, gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';

/** Resource clock arithmetic: continuous and discrete pools, their accrual anchors, and affordability deadlines. */

export interface ResourceClock {
  value: number;
  maximum: number;
  updatedAt: number;
  rate: number;
  /** Positive recovery may stop below capacity without discarding grants above that limit. */
  recoveryMaximum?: number;
}

// Runtime observations retain one fixed segment; only resource mutations replace its anchor.
const resourceAnchors = new WeakMap<ResourceClock, ResourceClock>();
export function resourceAnchor(clock: ResourceClock): ResourceClock {
  return resourceAnchors.get(clock) ?? clock;
}

export function anchorResourceClock(clock: ResourceClock): void {
  resourceAnchors.set(clock, { ...clock });
}

/** Queries a fixed accrual anchor without accumulating rounding from intermediate observations. */
export function resourceValueAt(clock: ResourceClock, at: number): number {
  const anchor = resourceAnchor(clock);
  const value = cappedResource(anchor.value + (at - anchor.updatedAt) * anchor.rate, anchor.maximum);
  return anchor.rate > 0 ? Math.min(value, Math.max(anchor.value, anchor.recoveryMaximum ?? anchor.maximum)) : value;
}

/** Returns the next zero crossing; a non-draining resource has no depletion deadline. */
export function resourceDepletionAt(clock: ResourceClock): number {
  const anchor = resourceAnchor(clock);
  return anchor.rate < 0 ? anchor.updatedAt + anchor.value / -anchor.rate : Infinity;
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

export interface DiscreteResourceClock extends ResourceClock {
  interval: number;
  amount: number;
  nextAt: number;
}

/** Factories create detached pools; selected policies supply their tuning during runtime initialization. */
export function createResourceClock(value = 0): ResourceClock {
  return { value, maximum: value, rate: 0, updatedAt: 0 };
}

export function createDiscreteResourceClock(value = 0): DiscreteResourceClock {
  return { ...createResourceClock(value), interval: 0, amount: 1, nextAt: Infinity };
}

/** Reads preserve continuous anchors so partitioning an observation cannot shift threshold detection. */
export function resourceAt(state: ResourceClock, at: number): number {
  if (at < state.updatedAt || !Number.isFinite(at))
    throw new RangeError('Resource time must be finite and nondecreasing.');
  if ('nextAt' in state) {
    const discrete = state as DiscreteResourceClock;
    if (!(discrete.interval > 0)) return state.value;
    const ticks = advanceDiscreteResource(0, Infinity, discrete.nextAt, discrete.interval, at).value;
    return Math.min(state.maximum, state.value + ticks * discrete.amount);
  }

  return resourceValueAt(state, at);
}

/** Settle the old segment before a mutation, keeping discrete phase even when grants overflow. */
export function advanceResource(state: ResourceClock, at: number): void {
  const value = resourceAt(state, at);
  if ('nextAt' in state) {
    const discrete = state as DiscreteResourceClock;
    if (discrete.interval > 0)
      discrete.nextAt = advanceDiscreteResource(0, Infinity, discrete.nextAt, discrete.interval, at).nextAt;
  }

  state.value = value;
  state.updatedAt = at;
}

/** Pure pool affordability shared by command execution and live resource policies. */
export function resourceRecoveryReadyAt(state: ResourceClock, cost: number, at: number): number | null {
  if (!Number.isFinite(cost) || cost < 0) throw new RangeError('Resource cost must be finite and non-negative.');
  const value = resourceAt(state, at);
  const anchor = resourceAnchor(state);
  // Recovery-funded thresholds remain tick aligned even when another event observes sufficient fractional value first.
  if (resourceAtLeast(value, cost)) {
    if (state.rate > 0 && !resourceAtLeast(anchor.value, cost))
      return Math.max(at, gw2CooldownReadyAt(anchor.updatedAt + (cost - anchor.value) / state.rate));
    return at;
  }

  if (cost > state.maximum) return null;
  let readyAt = Infinity;
  if ('nextAt' in state) {
    const discrete = state as DiscreteResourceClock;
    if (discrete.interval > 0 && discrete.amount > 0 && Number.isFinite(discrete.nextAt)) {
      const next = advanceDiscreteResource(0, Infinity, discrete.nextAt, discrete.interval, at).nextAt;
      readyAt = gw2CooldownReadyAt(next + (Math.ceil((cost - value) / discrete.amount) - 1) * discrete.interval);
    }
  } else if (state.rate > 0 && cost <= (state.recoveryMaximum ?? state.maximum)) {
    readyAt = gw2CooldownReadyAt(anchor.updatedAt + (cost - anchor.value) / state.rate);
  }

  if (!Number.isFinite(readyAt)) return null;
  // A rounded recovery forecast must remain future while the current balance is still below the cost.
  return readyAt <= at ? gw2CooldownReadyAt(at + GW2_ACTION_TICK_MS / 1000) : readyAt;
}
