type StateRestore = () => void;
type StatePreserver = () => StateRestore;

const statePreservers = new WeakMap<object, StatePreserver>();

/** Lets a specialization preserve resolver-only fields without exposing their names to Core reconciliation. */
export function registerNecromancerStatePreserver(state: object, preserver: StatePreserver): void {
  statePreservers.set(state, preserver);
}

export function captureNecromancerStatePreserver(state: object): StateRestore {
  return statePreservers.get(state)?.() || (() => undefined);
}
