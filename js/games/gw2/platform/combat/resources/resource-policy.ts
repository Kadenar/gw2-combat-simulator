import type { SchedulerContext, ScheduledTask } from '#gw2/platform/execution/types.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  advanceDiscreteResource,
  resourceValueAt,
  resourceAnchor,
  anchorResourceClock
} from '#gw2/platform/combat/resources/clock.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';

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
export interface ResourcePolicy<TContext = SchedulerContext<any>> {
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

function nonnegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and non-negative.`);
  return value;
}

function resource(context: SchedulerContext<any>, key: ResourceKey) {
  const policy = context.profession.resources[key];
  if (!policy) throw new TypeError(`Unsupported resource: ${key}.`);
  const state = policy.state(context);
  nonnegative(state.value, 'Resource value');
  nonnegative(state.maximum, 'Resource maximum');
  if (!Number.isFinite(state.updatedAt) || !Number.isFinite(state.rate)) throw new TypeError('Invalid resource clock.');
  return { policy, state };
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

/** Initialize from the active catalog; policy snapshots are the only live capacity/rate representation. */
export function initializeProfessionResources(context: SchedulerContext<any>, scheduleDepletion = false): void {
  const pools = new Set<ResourceClock>();
  for (const key of RESOURCE_KEYS) {
    const policy = context.profession.resources[key];
    if (!policy) continue;
    const state = policy.state(context);
    if (pools.has(state)) throw new TypeError(`Resource pool has multiple owners: ${key}.`);
    pools.add(state);
    const maximum = nonnegative(policy.maximum(context), 'Resource maximum');
    Object.assign(state, {
      value: Math.min(maximum, nonnegative(policy.initial(context, maximum), 'Initial resource')),
      maximum,
      rate: 0,
      updatedAt: 0
    });
    anchorResourceClock(state);
    refreshResource(context, key, false);
    if (policy.kind === 'discrete') {
      const discrete = state as DiscreteResourceClock;
      const recovery = policy.recovery(context) as { start: string };
      discrete.nextAt =
        discrete.interval > 0 && discrete.amount > 0 && (recovery.start === 'immediate' || state.value < maximum)
          ? discrete.interval
          : Infinity;
    }

    if (scheduleDepletion) updateDepletion(context, policy, state);
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

/** The scheduler advances registered pools once before profession observers at each boundary. */
export function advanceProfessionResources(context: SchedulerContext<any>, at: number): void {
  for (const key of RESOURCE_KEYS) {
    const policy = context.profession.resources[key];
    if (policy) advanceResource(policy.state(context), at);
  }
}

/** Transitions explicitly replace tuning only after recovery under the previous rules has settled. */
export function refreshResource(
  context: SchedulerContext<any>,
  key: ResourceKey,
  schedule = true,
  at = context.state.time
): void {
  if (schedule && deferResource(context, key, at, { kind: 'refresh' })) return;
  const { policy, state } = resource(context, key);
  const maximum = nonnegative(policy.maximum(context), 'Resource maximum');
  const recovery = policy.recovery(context);
  if ((policy.kind === 'continuous') !== (typeof recovery === 'number'))
    throw new TypeError('Resource recovery must match its kind.');
  const recoveryMaximum = policy.recoveryMaximum
    ? nonnegative(policy.recoveryMaximum(context), 'Recovery maximum')
    : undefined;
  if (typeof recovery === 'number') {
    if (!Number.isFinite(recovery)) throw new TypeError('Resource rate must be finite.');
  } else {
    nonnegative(recovery.interval, 'Resource interval');
    nonnegative(recovery.amount, 'Resource pulse');
    if (recovery.interval > 0 && timeKey(recovery.interval) <= 0)
      throw new RangeError('Resource intervals must span at least one clock unit.');
    if (!['immediate', 'first-spend'].includes(recovery.start)) throw new TypeError('Invalid resource cadence start.');
  }

  advanceResource(state, context.state.time);
  const changed = state.maximum !== maximum || state.rate !== recovery || state.recoveryMaximum !== recoveryMaximum;
  state.maximum = maximum;
  if (recoveryMaximum != null) state.recoveryMaximum = recoveryMaximum;
  state.value = Math.min(state.value, maximum);
  if (typeof recovery === 'number') state.rate = recovery;
  else {
    const discrete = state as DiscreteResourceClock;
    const wasDisabled = discrete.interval === 0 || discrete.amount === 0;
    discrete.interval = recovery.interval;
    discrete.amount = recovery.amount;
    if (recovery.interval === 0 || recovery.amount === 0) discrete.nextAt = Infinity;
    // Changing a running cadence preserves its pending pulse; re-enabling starts a fresh eligible cadence.
    else if (wasDisabled && (recovery.start === 'immediate' || state.value < maximum))
      discrete.nextAt = canonicalTime(context.state.time + recovery.interval);
  }

  if (changed) anchorResourceClock(state);
  if (schedule) updateDepletion(context, policy, state);
}

function updateDepletion(context: SchedulerContext<any>, policy: ResourcePolicy, state: ResourceClock): void {
  if (policy.depletion) {
    if (state.maximum > 0) policy.depletion.refresh(context);
    else policy.depletion.stop(context);
  }
}

/** Mutations are chronological and reject invalid requests before changing any state. */
export function grantResource(
  context: SchedulerContext<any>,
  key: ResourceKey,
  amount: number,
  at = context.state.time
): void {
  nonnegative(amount, 'Resource grant');
  if (deferResource(context, key, at, { kind: 'grant', amount })) return;
  const { policy, state } = resource(context, key);
  advanceResource(state, context.state.time);
  const before = state.value;
  state.value = Math.min(state.maximum, state.value + amount);
  if (state.value !== before) anchorResourceClock(state);
  updateDepletion(context, policy, state);
}

export function spendResource(context: SchedulerContext<any>, key: ResourceKey, amount: number): void {
  nonnegative(amount, 'Resource cost');
  const { policy, state } = resource(context, key);
  if (resourceAt(state, context.state.time) + 1e-9 < amount) throw new RangeError(`Insufficient ${key}.`);
  advanceResource(state, context.state.time);
  state.value = Math.max(0, state.value - amount);
  if ('nextAt' in state && amount > 0) {
    const discrete = state as DiscreteResourceClock;
    if (discrete.nextAt === Infinity && discrete.interval > 0 && discrete.amount > 0)
      discrete.nextAt = canonicalTime(context.state.time + discrete.interval);
  }

  if (amount > 0) anchorResourceClock(state);
  updateDepletion(context, policy, state);
}

/** Readiness is a pure recovery calculation; the scheduler still wakes earlier for causal tasks. */
export function resourceReadyAt(
  context: SchedulerContext<any>,
  key: ResourceKey,
  cost: number,
  at = context.state.time
): number | null {
  nonnegative(cost, 'Resource cost');
  const { policy, state } = resource(context, key);
  const value = resourceAt(state, at);
  const anchor = resourceAnchor(state);
  const nextRefresh = context.tasks.nextAt(`platform.resource-refresh:${key}`);
  const nextChange = Math.min(
    policy.nextChange?.(context, cost) ?? Infinity,
    context.tasks.nextAt(`platform.resource:${key}`),
    nextRefresh
  );
  // Recovery-funded thresholds remain tick aligned even when another event observes sufficient fractional value first.
  if (value + 1e-9 >= cost) {
    if (state.rate > 0 && anchor.value + 1e-9 < cost)
      return Math.max(at, gw2CooldownReadyAt(anchor.updatedAt + (cost - anchor.value) / state.rate));
    return at;
  }

  if (cost > state.maximum) return Number.isFinite(nextRefresh) && nextRefresh > at ? nextRefresh : null;
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

  const next = Math.min(readyAt, nextChange);
  return Number.isFinite(next) && next > at ? next : null;
}

type ResourceMutation = { kind: 'grant' | 'set'; amount: number } | { kind: 'refresh' };
/** Reuse owned scheduler tasks for future changes; no profession maintains a second mutation queue. */
function deferResource(
  context: SchedulerContext<any>,
  key: ResourceKey,
  at: number,
  payload: ResourceMutation
): boolean {
  resource(context, key);
  if (!Number.isFinite(at)) throw new RangeError('Resource time must be finite.');
  at = canonicalTime(at);
  if (at < context.state.time) throw new RangeError('Resource changes cannot precede the scheduler clock.');
  if (payload.kind === 'grant' && payload.amount === 0) return true;
  if (at === context.state.time) return false;
  context.tasks.schedule({
    type: payload.kind === 'refresh' ? `platform.resource-refresh:${key}` : `platform.resource:${key}`,
    at,
    ownerId: 'reservationId' in context ? String(context.reservationId) : undefined,
    payload
  });
  return true;
}

/** Explicit resets replace the value without resetting a running discrete cadence. */
export function setResource(
  context: SchedulerContext<any>,
  key: ResourceKey,
  value: number,
  at = context.state.time
): void {
  nonnegative(value, 'Resource value');
  if (deferResource(context, key, at, { kind: 'set', amount: value })) return;
  const { policy, state } = resource(context, key);
  advanceResource(state, context.state.time);
  state.value = Math.min(state.maximum, value);
  anchorResourceClock(state);
  updateDepletion(context, policy, state);
}

export const resourceTaskHandlers = Object.fromEntries(
  RESOURCE_KEYS.flatMap((key) => {
    const handler = (context: SchedulerContext<any>, task: ScheduledTask<ResourceMutation>) => {
      const mutation = task.payload;
      if (!mutation) throw new TypeError('Missing resource mutation.');
      if (mutation.kind === 'grant') grantResource(context, key, mutation.amount);
      else if (mutation.kind === 'set') setResource(context, key, mutation.amount);
      else refreshResource(context, key);
      context.profession.resources[key]?.changed?.(context, task.at);
    };

    return [
      [`platform.resource:${key}`, handler],
      [`platform.resource-refresh:${key}`, handler]
    ];
  })
);
