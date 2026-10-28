import { GW2_ACTION_TICK_MS, gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { boonIntervalsFromWindows, boonKey, prepareBoonWindows, type BoonWindow } from '#gw2/platform/combat/boons.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { RateInterval } from '#gw2/platform/combat/resources/pool.js';
import { cappedResource, grantCapped, resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Cache one runtime's append-only executed history; unrelated facts cannot change its prepared self-Vigor windows. */
export function createVigorWindowReader(events: readonly SimulationEvent[]): () => readonly BoonWindow[] {
  const kind = boonKey(BOON.VIGOR);
  const relevant: SimulationEvent[] = [];
  let cursor = 0;
  let windows: readonly BoonWindow[] | undefined;
  return () => {
    let dirty = false;
    // Consume execution order, including new facts at the same timestamp as an earlier readiness query.
    while (cursor < events.length) {
      const event = events[cursor++];

      if (
        !event.cancelled &&
        ((event.type === 'buff' && String(event.kind).toLowerCase() === kind) ||
          (event.type === 'boon_extension' && (!event.kind || event.kind === kind) && event.excludedKind !== kind))
      ) {
        relevant.push(event);
        dirty = true;
      }
    }

    if (!windows || dirty) windows = prepareBoonWindows(relevant, kind, RECIPIENT.SELF, undefined, true);

    return windows;
  };
}

/** Shares self-Vigor history for recovery and readiness while professions retain their rate policy. */
export function* vigorEnduranceIntervals(
  context: {
    readonly vigorWindows: () => readonly BoonWindow[];
    readonly config: Pick<Gw2Config, 'boons'>;
  },
  start: number,
  end: number,
  rateAt: (vigor: boolean, at: number) => number,
  rateBoundaries: readonly number[] = []
): Generator<RateInterval> {
  // Endurance uses executed self-Vigor history; empty windows and permanent Vigor need no history reconstruction.
  if (end <= start) return;

  const intervals = context.config.boons?.vigor
    ? [{ start, end, active: true }]
    : boonIntervalsFromWindows(context.vigorWindows(), start, end);
  // Timed profession bonuses split the same windows used by both recovery and affordability forecasts.
  const boundaries = [...new Set(rateBoundaries.filter((at) => at > start && at < end))].sort((a, b) => a - b);
  let index = 0;
  for (const interval of intervals) {
    let from = interval.start;
    while (index < boundaries.length && boundaries[index] < interval.end) {
      const boundary = boundaries[index++];

      if (boundary <= from) continue;

      yield { start: from, end: boundary, rate: rateAt(interval.active, from) };
      from = boundary;
    }

    yield { start: from, end: interval.end, rate: rateAt(interval.active, from) };
  }
}

/** Advances capped endurance without allowing an older scheduler timestamp to regenerate or rewind state. */
export function advanceEndurance(
  state: Readonly<ResourceClock>,
  at: number,
  regenerationPerSecond: number
): ResourceClock {
  if (at <= state.updatedAt) {
    return { ...state };
  }

  // A zero rate must remain idle even when an observation window has no finite endpoint.
  const rate = Math.max(0, regenerationPerSecond);
  return {
    ...state,
    value: cappedResource(state.value + (rate === 0 ? 0 : (at - state.updatedAt) * rate), state.maximum),
    updatedAt: at,
    rate
  };
}

/** Pays a non-negative endurance cost and anchors subsequent regeneration at the spend timestamp. */
export function spendEndurance(state: Readonly<ResourceClock>, amount: number, at: number): ResourceClock {
  return {
    ...state,
    value: cappedResource(state.value - Math.max(0, amount), state.maximum),
    updatedAt: Math.max(state.updatedAt, at)
  };
}

/** Adds a non-negative endurance grant up to the supplied cap and anchors regeneration at the grant timestamp. */
export function grantEndurance(state: Readonly<ResourceClock>, amount: number, at: number): ResourceClock {
  return {
    ...state,
    value: grantCapped(state.value, amount, state.maximum),
    updatedAt: Math.max(state.updatedAt, at)
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

  // Only resource arithmetic drift is tolerated; timestamp precision must not discount the cost.
  if (resourceAtLeast(currentEndurance, Math.max(0, cost))) return at;

  return regenerationPerSecond > 0 ? at + missing / regenerationPerSecond : null;
}

/** Settle only through the observation time, retaining its active policy rate without replaying history or accruing gaps. */
export function advanceEnduranceIntervals(
  state: Readonly<ResourceClock>,
  intervals: Iterable<RateInterval>,
  at = Infinity
): ResourceClock {
  let current = { ...state };
  for (const interval of intervals) {
    if (interval.start > at) break;

    const start = Math.max(current.updatedAt, interval.start);
    const end = Math.min(interval.end, at);

    if (end > start) current = advanceEndurance({ ...current, updatedAt: start }, end, interval.rate);

    if (interval.end > at) {
      current.rate = Math.max(0, interval.rate);
      break;
    }
  }

  return current;
}

/** Predicts affordability using advancement's capped, nonnegative recovery and stops at the first funded window. */
export function enduranceIntervalsReadyAt(
  state: Readonly<ResourceClock>,
  cost: number,
  intervals: Iterable<RateInterval>
): number | null {
  if (!resourceAtLeast(Math.max(0, state.maximum), cost)) return null;

  let current = {
    ...state,
    value: cappedResource(state.value, state.maximum),
    updatedAt: state.updatedAt
  };
  for (const interval of intervals) {
    const start = Math.max(current.updatedAt, interval.start);

    if (interval.end <= start) continue;

    const readyAt = enduranceThresholdAt(current.value, cost, start, interval.rate);

    if (readyAt != null && Number.isFinite(readyAt) && readyAt <= interval.end) {
      if (resourceAtLeast(current.value, cost) && start === state.updatedAt) return start;

      const tickAt = gw2CooldownReadyAt(readyAt);
      // Clock rounding cannot turn a real shortage into present affordability, even below microsecond precision.
      return tickAt <= start && !resourceAtLeast(current.value, cost)
        ? gw2CooldownReadyAt(start + GW2_ACTION_TICK_MS / 1000)
        : tickAt;
    }

    if (interval.end === Infinity) return null;

    current = advanceEndurance({ ...current, updatedAt: start }, interval.end, interval.rate);
  }

  return null;
}
