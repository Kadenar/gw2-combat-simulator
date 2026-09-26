import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { advanceDiscreteResource, resourceValueAt, resourceAnchor } from '#gw2/platform/combat/resources/clock.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';

/** Resource keys belong under the existing capability container, never alongside profession state. */
export const RESOURCE_KEYS = [
  'tomePages',
  'arrows',
  'initiative',
  'shadowForce',
  'astralForce',
  'energy',
  'lifeForce'
] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];
export interface DiscreteResourceClock extends ResourceClock {
  interval: number;
  amount: number;
  nextAt: number;
}
export interface ResourcePolicy<TContext = Gw2Runtime<any>> {
  readonly kind: 'continuous' | 'discrete';
  readonly depletion?: { refresh(context: TContext): void; stop(context: TContext): void };
  readonly recoveryMaximum?: (context: TContext) => number;
  readonly changed?: (context: TContext, at: number) => void;
  readonly nextChange?: (context: TContext, cost: number) => number;
  state(context: TContext): ResourceClock | DiscreteResourceClock;
  maximum(context: TContext): number;
  initial(context: TContext, maximum: number): number;
  recovery(context: TContext): number | { interval: number; amount: number; start: 'immediate' | 'first-spend' };
}
export type ResourcePolicies = Partial<Record<ResourceKey, ResourcePolicy>>;

/** Factories create detached pools; selected policies supply their tuning during runtime initialization. */
export function createResourceClock(value = 0): ResourceClock {
  return { value, maximum: value, rate: 0, updatedAt: 0 };
}

export function createDiscreteResourceClock(value = 0): DiscreteResourceClock {
  return { ...createResourceClock(value), interval: 0, amount: 1, nextAt: Infinity };
}

/** Extract only capabilities, leaving profession state factories out of resource dispatch. */
export function resourcePolicies(resources: ResourcePolicies): ResourcePolicies {
  return Object.fromEntries(RESOURCE_KEYS.filter((key) => resources[key] != null).map((key) => [key, resources[key]]));
}

/** Validate declarations before any simulation can silently omit a declared resource. */
export function validateResourcePolicies(resources: ResourcePolicies): void {
  for (const policy of Object.values(resourcePolicies(resources))) {
    if (
      !['continuous', 'discrete'].includes(policy.kind) ||
      ['state', 'maximum', 'initial', 'recovery'].some(
        (key) => typeof policy[key as keyof ResourcePolicy] !== 'function'
      )
    )
      throw new TypeError('Resource policies require kind, state, maximum, initial, and recovery.');
  }
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
  if (value + 1e-9 >= cost) {
    if (state.rate > 0 && anchor.value + 1e-9 < cost)
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

  return Number.isFinite(readyAt) ? readyAt : null;
}
