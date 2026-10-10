/**
 * Bind a hand-built fixture runtime to a family's compiled trigger tables, so the mechanic hooks under test fire the
 * same selected listeners, in the same order, as a simulation. Returns the compiled runtime profession, whose composed
 * hooks also include the trait triggers on platform stages.
 */
export function bindTriggerPoints(runtime, family, config = {}) {
  const profession = family.runtimeFor(config);
  // Fixture runtimes serve both mechanic and query capabilities.
  if (!('queries' in runtime)) runtime.queries = runtime;
  runtime.fireTrigger = (point, input) => {
    for (const listener of profession.triggerListeners.get(point.id) ?? []) listener(runtime, input);
  };

  return profession;
}
