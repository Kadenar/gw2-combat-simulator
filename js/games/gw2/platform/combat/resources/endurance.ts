/** The shared state fields required by standard GW2 endurance arithmetic. */
export interface Gw2EnduranceState {
  readonly endurance: number;
  readonly enduranceUpdatedAt: number;
}

/** A pure endurance result that callers can copy into their profession-owned state. */
export interface Gw2EnduranceUpdate {
  readonly endurance: number;
  readonly enduranceUpdatedAt: number;
}

/** A chronological recovery window; professions supply their own boon and trait rate policy. */
export interface Gw2EnduranceInterval {
  readonly start: number;
  readonly end: number;
  readonly rate: number;
}

function cappedEndurance(value: number, maximumEndurance: number): number {
  return Math.max(0, Math.min(Math.max(0, maximumEndurance), value));
}

/** Advances capped endurance without allowing an older scheduler timestamp to regenerate or rewind state. */
export function advanceEndurance(
  state: Gw2EnduranceState,
  at: number,
  regenerationPerSecond: number,
  maximumEndurance: number
): Gw2EnduranceUpdate {
  if (at <= state.enduranceUpdatedAt) {
    return {
      endurance: state.endurance,
      enduranceUpdatedAt: state.enduranceUpdatedAt
    };
  }

  // A zero rate must remain idle even when an observation window has no finite endpoint.
  const rate = Math.max(0, regenerationPerSecond);
  return {
    endurance: cappedEndurance(
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
): Gw2EnduranceUpdate {
  return {
    endurance: cappedEndurance(state.endurance - Math.max(0, amount), maximumEndurance),
    enduranceUpdatedAt: Math.max(state.enduranceUpdatedAt, at)
  };
}

/** Adds a non-negative endurance grant up to the supplied cap and anchors regeneration at the grant timestamp. */
export function grantEndurance(
  state: Gw2EnduranceState,
  amount: number,
  at: number,
  maximumEndurance: number
): Gw2EnduranceUpdate {
  return {
    endurance: cappedEndurance(state.endurance + Math.max(0, amount), maximumEndurance),
    enduranceUpdatedAt: Math.max(state.enduranceUpdatedAt, at)
  };
}

/** Returns the first retry time for an endurance cost, or null when the effective rate cannot satisfy it. */
export function enduranceReadyAt(
  currentEndurance: number,
  cost: number,
  at: number,
  regenerationPerSecond: number,
  epsilon: number
): number | null {
  const missing = Math.max(0, Math.max(0, cost) - currentEndurance);
  if (missing <= Math.max(0, epsilon)) return at;
  return regenerationPerSecond > 0 ? at + missing / regenerationPerSecond : null;
}

/** Integrates chronological windows without mutating the caller, accruing gaps, or replaying settled time. */
export function advanceEnduranceIntervals(
  state: Gw2EnduranceState,
  intervals: Iterable<Gw2EnduranceInterval>,
  maximumEndurance: number
): Gw2EnduranceUpdate {
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
  maximumEndurance: number,
  epsilon: number
): number | null {
  if (cost - Math.max(0, maximumEndurance) > Math.max(0, epsilon)) return null;
  let current = {
    endurance: cappedEndurance(state.endurance, maximumEndurance),
    enduranceUpdatedAt: state.enduranceUpdatedAt
  };
  for (const interval of intervals) {
    const start = Math.max(current.enduranceUpdatedAt, interval.start);
    if (interval.end <= start) continue;
    const readyAt = enduranceReadyAt(current.endurance, cost, start, interval.rate, epsilon);
    if (readyAt != null && Number.isFinite(readyAt) && readyAt <= interval.end) return readyAt;
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
