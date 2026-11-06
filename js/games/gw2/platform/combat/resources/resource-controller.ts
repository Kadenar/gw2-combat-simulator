/** Resource policies select live pools; domain clocks settle balances without scheduler or aggregate runtime access. */
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import {
  advanceResource,
  anchorResourceClock,
  resourceAt,
  resourceDepletionAt,
  resourceRecoveryReadyAt,
  type DiscreteResourceClock
} from '#gw2/platform/combat/resources/clock.js';
import { resourceAmount, resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import type {
  ResourceController,
  ResourceKey,
  ResourcePolicy,
  ResourceQueries
} from '#gw2/platform/combat/resources/resource-policy.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { createDeferredQueries } from '#kernel/core/deferred-queries.js';

export interface ResourceDepletionWake {
  synchronize(request: {
    readonly key: ResourceKey;
    readonly task: string;
    readonly at: number;
    readonly priority: number;
    readonly retainUnchangedDeadline: boolean;
  }): void;
}
interface ResourceControllerOptions<TContext> {
  readonly clock: { readonly time: number };
  readonly context: () => TContext;
  readonly policies: Partial<Record<ResourceKey, ResourcePolicy<TContext>>>;
  readonly depletion: ResourceDepletionWake;
}

/** Retained queries resolve the current controller only when invoked, including during deferred assembly. */
export function createResourceQueries(readController: () => ResourceController): ResourceQueries {
  return createDeferredQueries(readController, ['value', 'readyAt']);
}

/** Policies select live pools; every mutation settles the old segment before changing capacity, value or rate. */
export function createResourceController<TContext>({
  clock,
  context,
  policies,
  depletion: depletionWake
}: ResourceControllerOptions<TContext>): ResourceController {
  const pools = new Set();
  // Explicitly absent optional policies grant no pool, matching runtime capability admission.
  const keys = (Object.keys(policies) as ResourceKey[]).filter((key) => policies[key] != null);
  const get = (key: ResourceKey) => {
    const policy = policies[key];

    if (!policy) throw new TypeError(`Unsupported resource: ${key}.`);

    const state = policy.state(context());

    if (![state.value, state.maximum, state.updatedAt, state.unitsPerSecond].every(Number.isFinite))
      throw new TypeError('Invalid resource clock.');

    return { policy, state };
  };

  // Reuse the caller's validated pool to align its depletion wake without selecting or validating state again.
  const syncDepletion = (key: ResourceKey, { policy, state }: ReturnType<typeof get>) => {
    const depletion = policy.depletion;

    if (!depletion) return;

    const zeroAt = resourceDepletionAt(state);
    const at =
      state.maximum > 0
        ? depletion.deadline
          ? depletion.deadline(context(), zeroAt)
          : gw2CooldownReadyAt(zeroAt)
        : Infinity;

    if (at !== Infinity && (!Number.isFinite(at) || at < clock.time))
      throw new RangeError(`Invalid depletion deadline for ${key}.`);

    depletionWake.synchronize({
      key,
      task: depletion.task,
      at,
      priority: depletion.priority,
      retainUnchangedDeadline: depletion.retainUnchangedDeadline ?? false
    });
  };

  const refresh = (key: ResourceKey) => {
    const { policy, state } = get(key);
    advanceResource(state, clock.time);
    const before = [state.maximum, state.value, state.unitsPerSecond, state.recoveryMaximum];
    state.maximum = resourceAmount(policy.maximum(context()));
    state.value = Math.min(state.value, state.maximum);

    // Pools without a recovery ceiling keep the factory's shape instead of gaining an undefined field.
    if (policy.recoveryMaximum) state.recoveryMaximum = resourceAmount(policy.recoveryMaximum(context()));
    else delete state.recoveryMaximum;

    const recovery = policy.recovery(context());

    if ((policy.kind === 'continuous') !== (typeof recovery === 'number'))
      throw new TypeError('Resource recovery must match its kind.');

    if (typeof recovery === 'number') {
      if (!Number.isFinite(recovery)) throw new TypeError('Invalid resource rate.');

      state.unitsPerSecond = recovery;
    } else {
      const discrete = state as DiscreteResourceClock;
      const disabled = !(discrete.interval > 0 && discrete.unitsPerTick > 0);
      discrete.interval = resourceAmount(recovery.interval);
      discrete.unitsPerTick = resourceAmount(recovery.amount);

      if (discrete.interval > 0 && canonicalTime(discrete.interval) === 0)
        throw new RangeError('Resource cadence is below clock precision.');

      if (!['immediate', 'first-spend'].includes(recovery.start))
        throw new TypeError('Invalid resource cadence start.');

      if (!discrete.interval || !discrete.unitsPerTick) discrete.nextAt = Infinity;
      else if (disabled && (recovery.start === 'immediate' || state.value < state.maximum))
        discrete.nextAt = canonicalTime(clock.time + discrete.interval);
    }

    // Compare one settled snapshot so unchanged policies keep the existing accrual anchor.
    const after = [state.maximum, state.value, state.unitsPerSecond, state.recoveryMaximum];

    if (before.some((value, index) => value !== after[index])) anchorResourceClock(state);

    syncDepletion(key, { policy, state });
  };

  const initialize = () => {
    for (const key of keys) {
      const { policy, state } = get(key);

      if (pools.has(state)) throw new TypeError('Resource pool has multiple owners.');

      pools.add(state);
      state.maximum = resourceAmount(policy.maximum(context()));
      state.value = Math.min(state.maximum, resourceAmount(policy.initial(context(), state.maximum)));
      state.updatedAt = clock.time;
      state.unitsPerSecond = 0;

      if (policy.kind === 'discrete') Object.assign(state, { interval: 0, unitsPerTick: 0, nextAt: Infinity });

      anchorResourceClock(state);
      refresh(key);
    }
  };

  return Object.freeze({
    initialize,
    advance() {
      for (const key of keys) advanceResource(get(key).state, clock.time);
    },
    value(key: ResourceKey) {
      return resourceAt(get(key).state, clock.time);
    },
    refresh,
    /** Resets and conversions replace the settled balance without restarting recovery or emitting reward semantics. */
    replace(key: ResourceKey, value: number) {
      resourceAmount(value);
      const { policy, state } = get(key);
      advanceResource(state, clock.time);
      const next = Math.min(state.maximum, value);

      if (next === state.value) return;

      if (
        'nextAt' in state &&
        next < state.value &&
        state.nextAt === Infinity &&
        state.interval > 0 &&
        state.unitsPerTick > 0
      )
        state.nextAt = canonicalTime(clock.time + state.interval);

      state.value = next;
      anchorResourceClock(state);
      syncDepletion(key, { policy, state });
    },
    grant(key: ResourceKey, value: number) {
      resourceAmount(value);
      const { policy, state } = get(key);
      advanceResource(state, clock.time);
      const next = Math.min(state.maximum, state.value + value);

      if (next === state.value) return;

      state.value = next;
      anchorResourceClock(state);
      syncDepletion(key, { policy, state });
    },
    spend(key: ResourceKey, value: number) {
      resourceAmount(value);

      if (value === 0) return;

      const { policy, state } = get(key);

      if (!resourceAtLeast(resourceAt(state, clock.time), value)) throw new RangeError(`Insufficient ${key}.`);

      advanceResource(state, clock.time);
      state.value = Math.max(0, state.value - value);

      if ('nextAt' in state && value > 0) {
        const discrete = state;

        if (discrete.nextAt === Infinity && discrete.interval > 0 && discrete.unitsPerTick > 0)
          discrete.nextAt = canonicalTime(clock.time + discrete.interval);
      }

      anchorResourceClock(state);
      syncDepletion(key, { policy, state });
    },
    readyAt(key: ResourceKey, cost: number) {
      resourceAmount(cost);
      const { policy, state } = get(key);
      const next = Math.min(
        resourceRecoveryReadyAt(state, cost, clock.time) ?? Infinity,
        policy.nextChange?.(context(), cost) ?? Infinity
      );
      return Number.isFinite(next) ? Math.max(clock.time, next) : null;
    }
  });
}
