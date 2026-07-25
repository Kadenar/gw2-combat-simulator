import { simulateDeclarativeGw2 } from "./declarative-simulation.js";

/**
 * Canonical GW2 simulation entry point.
 *
 * Every supported profession uses the same scheduling and resolver pipeline.
 */
export function simulateGw2(options = {}) {
  return simulateDeclarativeGw2(options);
}
