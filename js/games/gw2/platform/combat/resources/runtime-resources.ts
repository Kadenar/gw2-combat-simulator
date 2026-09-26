import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { anchorResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  advanceResource,
  resourceAt,
  resourceRecoveryReadyAt,
  type DiscreteResourceClock,
  type ResourceKey
} from '#gw2/platform/combat/resources/resource-policy.js';
import {
  advanceEnduranceIntervals,
  enduranceIntervalsReadyAt,
  grantEndurance,
  spendEndurance,
  vigorEnduranceIntervals
} from '#gw2/platform/combat/resources/endurance.js';
import type { Gw2Runtime, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';

function amount(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Resource amounts must be finite and non-negative.');
  return value;
}

/** Policies select live pools; every mutation settles the old segment before changing capacity, value or rate. */
export function createRuntimeResources<T extends object>(runtime: Gw2Runtime<T>, profession: RuntimeProfession<T>) {
  const policies = profession.resources ?? {};
  const pools = new Set();
  const keys = Object.keys(policies) as ResourceKey[];
  const get = (key: ResourceKey) => {
    const policy = policies[key];
    if (!policy) throw new TypeError(`Unsupported resource: ${key}.`);
    const state = policy.state(runtime);
    if (![state.value, state.maximum, state.updatedAt, state.rate].every(Number.isFinite))
      throw new TypeError('Invalid resource clock.');
    return { policy, state };
  };

  const changed = (key: ResourceKey) => {
    const { policy, state } = get(key);
    if (policy.depletion) {
      if (state.maximum > 0) policy.depletion.refresh(runtime);
      else policy.depletion.stop(runtime);
    }

    policy.changed?.(runtime, runtime.time);
  };

  const refresh = (key: ResourceKey) => {
    const { policy, state } = get(key);
    advanceResource(state, runtime.time);
    const before = [state.maximum, state.value, state.rate, state.recoveryMaximum];
    state.maximum = amount(policy.maximum(runtime));
    state.value = Math.min(state.value, state.maximum);
    // Pools without a recovery ceiling keep the factory's shape instead of gaining an undefined field.
    if (policy.recoveryMaximum) state.recoveryMaximum = amount(policy.recoveryMaximum(runtime));
    else delete state.recoveryMaximum;
    const recovery = policy.recovery(runtime);
    if ((policy.kind === 'continuous') !== (typeof recovery === 'number'))
      throw new TypeError('Resource recovery must match its kind.');
    if (typeof recovery === 'number') {
      if (!Number.isFinite(recovery)) throw new TypeError('Invalid resource rate.');
      state.rate = recovery;
    } else {
      const discrete = state as DiscreteResourceClock;
      const disabled = !(discrete.interval > 0 && discrete.amount > 0);
      discrete.interval = amount(recovery.interval);
      discrete.amount = amount(recovery.amount);
      if (discrete.interval > 0 && canonicalTime(discrete.interval) === 0)
        throw new RangeError('Resource cadence is below clock precision.');
      if (!['immediate', 'first-spend'].includes(recovery.start))
        throw new TypeError('Invalid resource cadence start.');
      if (!discrete.interval || !discrete.amount) discrete.nextAt = Infinity;
      else if (disabled && (recovery.start === 'immediate' || state.value < state.maximum))
        discrete.nextAt = canonicalTime(runtime.time + discrete.interval);
    }

    if (before.some((value, index) => value !== [state.maximum, state.value, state.rate, state.recoveryMaximum][index]))
      anchorResourceClock(state);
    changed(key);
  };

  const initialize = () => {
    for (const key of keys) {
      const { policy, state } = get(key);
      if (pools.has(state)) throw new TypeError('Resource pool has multiple owners.');
      pools.add(state);
      state.maximum = amount(policy.maximum(runtime));
      state.value = Math.min(state.maximum, amount(policy.initial(runtime, state.maximum)));
      state.updatedAt = runtime.time;
      state.rate = 0;
      if (policy.kind === 'discrete') Object.assign(state, { interval: 0, amount: 0, nextAt: Infinity });
      anchorResourceClock(state);
      refresh(key);
    }
  };

  return Object.freeze({
    initialize,
    advance() {
      for (const key of keys) advanceResource(get(key).state, runtime.time);
    },
    value(key: ResourceKey) {
      return resourceAt(get(key).state, runtime.time);
    },
    refresh,
    grant(key: ResourceKey, value: number) {
      amount(value);
      const { state } = get(key);
      advanceResource(state, runtime.time);
      const next = Math.min(state.maximum, state.value + value);
      if (next === state.value) return;
      state.value = next;
      anchorResourceClock(state);
      changed(key);
    },
    spend(key: ResourceKey, value: number) {
      amount(value);
      if (value === 0) return;
      const { state } = get(key);
      if (resourceAt(state, runtime.time) + 1e-9 < value) throw new RangeError(`Insufficient ${key}.`);
      advanceResource(state, runtime.time);
      state.value = Math.max(0, state.value - value);
      if ('nextAt' in state && value > 0) {
        const discrete = state as DiscreteResourceClock;
        if (discrete.nextAt === Infinity && discrete.interval > 0 && discrete.amount > 0)
          discrete.nextAt = canonicalTime(runtime.time + discrete.interval);
      }

      anchorResourceClock(state);
      changed(key);
    },
    readyAt(key: ResourceKey, cost: number) {
      amount(cost);
      const { policy, state } = get(key);
      const next = Math.min(
        resourceRecoveryReadyAt(state, cost, runtime.time) ?? Infinity,
        policy.nextChange?.(runtime, cost) ?? Infinity
      );
      return Number.isFinite(next) ? Math.max(runtime.time, next) : null;
    }
  });
}

/** Endurance uses the same executed Vigor windows for regeneration and affordability, including elite pool selection. */
export function createRuntimeEndurance<T extends object>(runtime: Gw2Runtime<T>, profession: RuntimeProfession<T>) {
  const policy = profession.endurance;
  const pool = () => {
    if (!policy) throw new TypeError('Profession does not model endurance.');
    const state = policy.state(runtime);
    const maximum = amount(policy.maximum(runtime));
    if (![state.endurance, state.enduranceUpdatedAt].every(Number.isFinite) || maximum === 0)
      throw new TypeError('Invalid endurance pool.');
    return { state, maximum };
  };

  const intervals = (start: number, end: number) =>
    vigorEnduranceIntervals(
      { events: runtime.history, config: runtime.config },
      start,
      end,
      (vigor, at) => policy!.regenerationRate(runtime, vigor, at),
      policy?.regenerationBoundaries?.(runtime)
    );
  const advance = () => {
    if (!policy) return;
    const { state, maximum } = pool();
    Object.assign(state, advanceEnduranceIntervals(state, intervals(state.enduranceUpdatedAt, runtime.time), maximum));
  };

  if (policy) {
    const { state, maximum } = pool();
    // Honor explicit starting endurance before profession hooks, using the selected elite pool's bounds.
    const initial =
      'initialEndurance' in runtime.config && runtime.config.initialEndurance != null
        ? Number(runtime.config.initialEndurance)
        : maximum;
    if (!Number.isFinite(initial)) throw new TypeError('Initial endurance must be finite.');
    state.endurance = Math.max(0, Math.min(maximum, initial));
    state.enduranceUpdatedAt = runtime.time;
  }

  return Object.freeze({
    advance,
    readyAt(cost: number) {
      amount(cost);
      advance();
      const { state, maximum } = pool();
      return enduranceIntervalsReadyAt(state, cost, intervals(runtime.time, Infinity), maximum);
    },
    grant(value: number) {
      amount(value);
      if (!policy) return false;
      advance();
      const { state, maximum } = pool();
      Object.assign(state, grantEndurance(state, value, runtime.time, maximum));
      return true;
    },
    spend(value: number) {
      amount(value);
      advance();
      const { state, maximum } = pool();
      // Use the same affordability tolerance as endurance readiness after fractional regeneration.
      if (state.endurance < value - EPSILON) throw new RangeError('Insufficient endurance.');
      Object.assign(state, spendEndurance(state, value, runtime.time, maximum));
    }
  });
}
