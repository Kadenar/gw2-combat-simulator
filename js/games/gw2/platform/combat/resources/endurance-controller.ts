/** Endurance settles and projects the same injected regeneration intervals against the live selected pool. */
import {
  advanceEnduranceIntervals,
  enduranceIntervalsReadyAt,
  grantEndurance,
  spendEndurance
} from '#gw2/platform/combat/resources/endurance.js';
import { resourceAmount, resourceAtLeast, type RateInterval } from '#gw2/platform/combat/resources/pool.js';
import type {
  EnduranceController,
  EndurancePolicy,
  EnduranceQueries
} from '#gw2/platform/combat/resources/resource-policy.js';
import { createDeferredQueries } from '#kernel/core/deferred-queries.js';

interface EnduranceControllerOptions<TContext> {
  readonly clock: { readonly time: number };
  readonly context: () => TContext;
  readonly policy: EndurancePolicy<TContext> | undefined;
  readonly intervals: (start: number, end: number) => Iterable<RateInterval>;
}

/** Query construction never reads a controller before assembly has bound it. */
export function createEnduranceQueries(readController: () => EnduranceController): EnduranceQueries {
  return createDeferredQueries(readController, ['readyAt']);
}

/** Endurance uses the same executed Vigor windows for regeneration and affordability, including elite pool selection. */
export function createEnduranceController<TContext>({
  clock,
  context,
  policy,
  intervals
}: EnduranceControllerOptions<TContext>): EnduranceController {
  const pool = () => {
    if (!policy) throw new TypeError('Profession does not model endurance.');

    const state = policy.state(context());
    const maximum = resourceAmount(policy.maximum(context()));

    if (![state.value, state.maximum, state.updatedAt, state.unitsPerSecond].every(Number.isFinite) || maximum === 0)
      throw new TypeError('Invalid endurance pool.');

    return { state, maximum };
  };

  const advance = () => {
    if (!policy) return;

    const { state, maximum } = pool();
    // One interval traversal settles the balance and its current rate; ordinary pool advancement never accrues it again.
    Object.assign(
      state,
      advanceEnduranceIntervals({ ...state, maximum }, intervals(state.updatedAt, Infinity), clock.time)
    );
  };

  if (policy) {
    const { state, maximum } = pool();
    // Every simulation starts with the selected profession's full endurance pool.
    Object.assign(state, { value: maximum, maximum, updatedAt: clock.time, unitsPerSecond: 0 });
    advance();
  }

  return Object.freeze({
    advance,
    readyAt(cost: number) {
      resourceAmount(cost);
      const { state, maximum } = pool();
      // Availability is a query: project elapsed recovery without settling the live endurance clock.
      const current = advanceEnduranceIntervals({ ...state, maximum }, intervals(state.updatedAt, clock.time));
      return enduranceIntervalsReadyAt(current, cost, intervals(clock.time, Infinity));
    },
    grant(value: number) {
      resourceAmount(value);

      if (!policy) return false;

      advance();
      const { state } = pool();
      Object.assign(state, grantEndurance(state, value, clock.time));
      return true;
    },
    spend(value: number) {
      resourceAmount(value);
      advance();
      const { state } = pool();

      // Readiness and payment share resource rounding, never the simulation clock's time allowance.
      if (!resourceAtLeast(state.value, value)) throw new RangeError('Insufficient endurance.');

      Object.assign(state, spendEndurance(state, value, clock.time));
    }
  });
}
