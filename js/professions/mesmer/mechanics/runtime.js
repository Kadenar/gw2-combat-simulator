// Per-simulation mesmer scheduler runtime registry, keyed by simulation state.
// Kept in its own module so both the scheduler contract and the availability
// gate can resolve the active runtime without a circular import.
export const runtimes = new WeakMap();

export function runtimeFor(context) {
  const runtime = runtimes.get(context.state);
  if (!runtime) throw new Error("Mesmer scheduler runtime is not initialized.");
  return runtime;
}
