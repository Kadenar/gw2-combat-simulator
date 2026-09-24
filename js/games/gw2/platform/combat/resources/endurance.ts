import { EPSILON } from '#kernel/core/clock.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
/** The shared endurance fields read by, and returned from, standard GW2 endurance arithmetic. */

import { cappedResource, grantCapped } from '#gw2/platform/combat/resources/pool.js';
import { boonIntervals } from '#gw2/platform/combat/boons.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface Gw2EnduranceState {
  readonly endurance: number;
  readonly enduranceUpdatedAt: number;
}

/** A chronological recovery window; professions supply their own boon and trait rate policy. */
export interface Gw2EnduranceInterval {
  readonly start: number;
  readonly end: number;
  readonly rate: number;
}

/** Shares self-Vigor history for recovery and readiness while professions retain their rate policy. */
export function* vigorEnduranceIntervals(
  context: { readonly events: readonly SimulationEvent[]; readonly config: Pick<Gw2Config, 'boons'> },
  start: number,
  end: number,
  rateAt: (vigor: boolean, at: number) => number
): Generator<Gw2EnduranceInterval> {
  for (const interval of boonIntervals(context.events, 'vigor', start, end, Boolean(context.config.boons?.vigor))) {
    yield { start: interval.start, end: interval.end, rate: rateAt(interval.active, interval.start) };
  }
}

/** Advances capped endurance without allowing an older scheduler timestamp to regenerate or rewind state. */
export function advanceEndurance(
  state: Gw2EnduranceState,
  at: number,
  regenerationPerSecond: number,
  maximumEndurance: number
): Gw2EnduranceState {
  if (at <= state.enduranceUpdatedAt) {
    return {
      endurance: state.endurance,
      enduranceUpdatedAt: state.enduranceUpdatedAt
    };
  }

  // A zero rate must remain idle even when an observation window has no finite endpoint.
  const rate = Math.max(0, regenerationPerSecond);
  return {
    endurance: cappedResource(
      state.endurance + (rate === 0 ? 0 : (at - state.enduranceUpdatedAt) * rate),
      maximumEndurance
    ),
    enduranceUpdatedAt: at
  };
}

/** Pays a non-negative endurance cost and anchors subsequent regeneration at the spend timestamp. */
export function spendEndurance(
  state: Gw2EnduranceState,
  amount: number,
  at: number,
  maximumEndurance: number
): Gw2EnduranceState {
  return {
    endurance: cappedResource(state.endurance - Math.max(0, amount), maximumEndurance),
    enduranceUpdatedAt: Math.max(state.enduranceUpdatedAt, at)
  };
}

/** Adds a non-negative endurance grant up to the supplied cap and anchors regeneration at the grant timestamp. */
export function grantEndurance(
  state: Gw2EnduranceState,
  amount: number,
  at: number,
  maximumEndurance: number
): Gw2EnduranceState {
  return {
    endurance: grantCapped(state.endurance, amount, maximumEndurance),
    enduranceUpdatedAt: Math.max(state.enduranceUpdatedAt, at)
  };
}

/** Finds the fractional threshold before applying tick detection, so boon boundaries cannot change earned progress. */
function enduranceThresholdAt(
  currentEndurance: number,
  cost: number,
  at: number,
  regenerationPerSecond: number
): number | null {
  const missing = Math.max(0, Math.max(0, cost) - currentEndurance);
  if (missing <= Math.max(0, EPSILON)) return at;
  return regenerationPerSecond > 0 ? at + missing / regenerationPerSecond : null;
}

/** Regeneration-funded costs become available on the next 40 ms tick; an already funded cost needs no wait. */
export function enduranceReadyAt(
  currentEndurance: number,
  cost: number,
  at: number,
  regenerationPerSecond: number
): number | null {
  const threshold = enduranceThresholdAt(currentEndurance, cost, at, regenerationPerSecond);
  return threshold == null || threshold === at ? threshold : gw2CooldownReadyAt(threshold);
}

/** Integrates chronological windows without mutating the caller, accruing gaps, or replaying settled time. */
export function advanceEnduranceIntervals(
  state: Gw2EnduranceState,
  intervals: Iterable<Gw2EnduranceInterval>,
  maximumEndurance: number
): Gw2EnduranceState {
  let current = { endurance: state.endurance, enduranceUpdatedAt: state.enduranceUpdatedAt };
  for (const interval of intervals) {
    const start = Math.max(current.enduranceUpdatedAt, interval.start);
    if (interval.end <= start) continue;
    current = advanceEndurance(
      { endurance: current.endurance, enduranceUpdatedAt: start },
      interval.end,
      interval.rate,
      maximumEndurance
    );
  }

  return current;
}

/** Predicts affordability using advancement's capped, nonnegative recovery and stops at the first funded window. */
export function enduranceIntervalsReadyAt(
  state: Gw2EnduranceState,
  cost: number,
  intervals: Iterable<Gw2EnduranceInterval>,
  maximumEndurance: number
): number | null {
  if (cost - Math.max(0, maximumEndurance) > Math.max(0, EPSILON)) return null;
  let current = {
    endurance: cappedResource(state.endurance, maximumEndurance),
    enduranceUpdatedAt: state.enduranceUpdatedAt
  };
  for (const interval of intervals) {
    const start = Math.max(current.enduranceUpdatedAt, interval.start);
    if (interval.end <= start) continue;
    const readyAt = enduranceThresholdAt(current.endurance, cost, start, interval.rate);
    if (readyAt != null && Number.isFinite(readyAt) && readyAt <= interval.end)
      return readyAt === state.enduranceUpdatedAt ? readyAt : gw2CooldownReadyAt(readyAt);
    if (interval.end === Infinity) return null;
    current = advanceEndurance(
      { endurance: current.endurance, enduranceUpdatedAt: start },
      interval.end,
      interval.rate,
      maximumEndurance
    );
  }

  return null;
}
