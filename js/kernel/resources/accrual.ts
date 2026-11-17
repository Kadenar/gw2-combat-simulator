/** Continuous resource arithmetic uses one accrual anchor per pool; callers settle and reanchor mutations. */
import { cappedResource, resourceAtLeast } from '#kernel/resources/pool.js';

export interface ResourceClock {
  value: number;
  maximum: number;
  updatedAt: number;
  unitsPerSecond: number;
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
  return valueFromAnchor(resourceAnchor(clock), at);
}

/** Share the projection arithmetic when a caller has already resolved the accrual anchor. */
function valueFromAnchor(anchor: ResourceClock, at: number): number {
  const value = cappedResource(anchor.value + (at - anchor.updatedAt) * anchor.unitsPerSecond, anchor.maximum);
  return anchor.unitsPerSecond > 0
    ? Math.min(value, Math.max(anchor.value, anchor.recoveryMaximum ?? anchor.maximum))
    : value;
}

/** Returns the next zero crossing; a non-draining resource has no depletion deadline. */
export function resourceDepletionAt(clock: ResourceClock): number {
  const anchor = resourceAnchor(clock);
  return anchor.unitsPerSecond < 0 ? anchor.updatedAt + anchor.value / -anchor.unitsPerSecond : Infinity;
}

/** Factories create detached pools; selected policies supply their tuning during runtime initialization. */
export function createResourceClock(value = 0): ResourceClock {
  return { value, maximum: value, unitsPerSecond: 0, updatedAt: 0 };
}

/** Funding distinguishes existing balance, completed recovery, and a cost still waiting for recovery. */
export interface ResourceThreshold {
  readonly at: number;
  readonly funding: 'existing' | 'recovered' | 'pending';
}

/**
 * Return an unrounded recovery crossing, or null when this segment cannot fund the cost.
 * A recovery-funded crossing can precede at after an intermediate observation; retaining it lets callers apply
 * their own detection policy. Costs already funded at the anchor, or by a non-growing pool, use the query time.
 * Owners must settle and reanchor every balance, rate, or capacity change before querying again.
 */
export function resourceThresholdAt(state: ResourceClock, cost: number, at: number): ResourceThreshold | null {
  if (!Number.isFinite(cost) || cost < 0) throw new RangeError('Resource cost must be finite and non-negative.');

  if (at < state.updatedAt || !Number.isFinite(at))
    throw new RangeError('Resource time must be finite and nondecreasing.');

  const anchor = resourceAnchor(state);
  const funded = resourceAtLeast(valueFromAnchor(anchor, at), cost);

  if (funded) {
    if (anchor.unitsPerSecond <= 0 || resourceAtLeast(anchor.value, cost)) return { at, funding: 'existing' };
  } else if (cost > anchor.maximum || anchor.unitsPerSecond <= 0 || cost > (anchor.recoveryMaximum ?? anchor.maximum)) {
    return null;
  }

  // This segment has one constant rate, so no interval objects or iterator are needed.
  const crossing = anchor.updatedAt + (cost - anchor.value) / anchor.unitsPerSecond;
  return Number.isFinite(crossing) ? { at: crossing, funding: funded ? 'recovered' : 'pending' } : null;
}
