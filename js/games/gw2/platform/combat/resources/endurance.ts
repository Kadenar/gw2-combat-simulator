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

  return {
    endurance: cappedEndurance(
      state.endurance + (at - state.enduranceUpdatedAt) * Math.max(0, regenerationPerSecond),
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
