import { simulateDeclarativeGw2 } from "./declarative-simulation.js";

/**
 * Canonical GW2 simulation entry point.
 *
 * A profession may provide a production pipeline when its mechanics need more
 * than the declarative engine. Callers never select that pipeline directly.
 */
export function simulateGw2(options = {}) {
  const { profession } = options;
  const professionPipeline = profession?.simulation?.simulate;
  if (typeof professionPipeline === "function") {
    return professionPipeline(options);
  }
  return simulateDeclarativeGw2(options);
}
