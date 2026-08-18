import { simulateDeclarativeGw2 } from './declarative-simulation.js';
import type { Gw2DeclarativeSimulationOptions, Gw2SimulationResult } from './types.js';

/**
 * Canonical GW2 simulation entry point.
 *
 * Every supported profession uses the same scheduling and resolver pipeline.
 */
export function simulateGw2(options: Gw2DeclarativeSimulationOptions): Gw2SimulationResult {
  return simulateDeclarativeGw2(options);
}
