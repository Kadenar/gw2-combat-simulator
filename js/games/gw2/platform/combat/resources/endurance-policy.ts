import type { SchedulerContext } from '#gw2/platform/execution/types.js';
import {
  advanceEnduranceIntervals,
  enduranceIntervalsReadyAt,
  grantEndurance,
  spendEndurance,
  vigorEnduranceIntervals
} from '#gw2/platform/combat/resources/endurance.js';

/** A profession selects its live pool and tuning; shared operations never assume Core owns endurance. */
export interface EndurancePolicy<TContext = SchedulerContext<any>> {
  state(context: TContext): { endurance: number; enduranceUpdatedAt: number };
  maximum(context: unknown): number;
  regenerationRate(context: TContext, vigor: boolean, at: number): number;
  regenerationBoundaries?(context: TContext): readonly number[];
}

/** Keep temporary profession bonuses and Vigor on one recovery timeline. */
function regenerationIntervals(context: SchedulerContext<any>, start: number, end: number) {
  const policy = context.profession.resources.endurance!;
  return vigorEnduranceIntervals(
    context,
    start,
    end,
    (vigor, at) => policy.regenerationRate(context, vigor, at),
    policy.regenerationBoundaries?.(context)
  );
}

/** Reject malformed declared resources instead of silently discarding grants. */
function pool(context: SchedulerContext<any>) {
  const policy = context.profession.resources.endurance;
  if (!policy) throw new TypeError('Profession does not model endurance.');
  const state = policy.state(context);
  const maximum = policy.maximum(context);
  if (
    !state ||
    !Number.isFinite(state.endurance) ||
    !Number.isFinite(state.enduranceUpdatedAt) ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    throw new TypeError('Invalid profession endurance state or maximum.');
  }

  return { policy, state, maximum };
}

/** Initialization uses the selected policy, including elite overrides, before gameplay hooks run. */
export function initializeProfessionEndurance(context: SchedulerContext<any>): void {
  if (!context.profession.resources.endurance) return;
  const { state, maximum } = pool(context);
  const initial =
    'initialEndurance' in context.config && context.config.initialEndurance != null
      ? Number(context.config.initialEndurance)
      : maximum;
  if (!Number.isFinite(initial)) throw new TypeError('Initial endurance must be finite.');
  state.endurance = Math.max(0, Math.min(maximum, initial));
  state.enduranceUpdatedAt = 0;
}

/** Continuous advancement and readiness share the exact same Vigor history and profession rate policy. */
export function advanceProfessionEndurance(context: SchedulerContext<any>, at: number): void {
  const { state, maximum } = pool(context);
  if (at <= state.enduranceUpdatedAt) return;
  Object.assign(
    state,
    advanceEnduranceIntervals(state, regenerationIntervals(context, state.enduranceUpdatedAt, at), maximum)
  );
}

/** Predict affordability without changing the live resource or its regeneration anchor. */
export function professionEnduranceReadyAt(
  context: SchedulerContext<any> & { readonly start?: number },
  cost: number,
  at = context.start ?? context.state.time
): number | null {
  const { state, maximum } = pool(context);
  const advanced = advanceEnduranceIntervals(
    state,
    regenerationIntervals(context, state.enduranceUpdatedAt, at),
    maximum
  );
  return enduranceIntervalsReadyAt(advanced, cost, regenerationIntervals(context, at, Infinity), maximum);
}

/** Discrete changes execute at the current clock, after preceding regeneration has settled. */
export function grantProfessionEndurance(context: SchedulerContext<any>, amount: number, at: number): boolean {
  if (!context.profession.resources.endurance) return false;
  if (!Number.isFinite(amount) || amount < 0 || at !== context.state.time)
    throw new RangeError('Endurance grants require a non-negative amount at the scheduler clock.');
  advanceProfessionEndurance(context, at);
  const { state, maximum } = pool(context);
  Object.assign(state, grantEndurance(state, amount, at, maximum));
  return true;
}

/** Spending uses the active capacity and never advances resources into a future cast. */
export function spendProfessionEndurance(context: SchedulerContext<any>, amount: number, at: number): void {
  if (!Number.isFinite(amount) || amount < 0 || at !== context.state.time)
    throw new RangeError('Endurance spending requires a non-negative amount at the scheduler clock.');
  advanceProfessionEndurance(context, at);
  const { state, maximum } = pool(context);
  Object.assign(state, spendEndurance(state, amount, at, maximum));
}
