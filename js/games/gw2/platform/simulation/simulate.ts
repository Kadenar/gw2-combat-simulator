import { simulateDeclarativeGw2, simulateDeclarativeGw2Score } from '#gw2/platform/simulation/pipeline.js';
import type { Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import type { Gw2DeclarativeSimulationOptions, Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

/**
 * Canonical GW2 simulation entry point.
 *
 * Every supported profession uses the same scheduling and resolver pipeline.
 */
export function simulateGw2(options: Gw2DeclarativeSimulationOptions & { output: 'score' }): Gw2SimulationScore;
export function simulateGw2(options: Gw2DeclarativeSimulationOptions & { output?: 'detailed' }): Gw2SimulationResult;
export function simulateGw2(
  options: Gw2DeclarativeSimulationOptions & { output?: 'detailed' | 'score' }
): Gw2SimulationResult | Gw2SimulationScore {
  return options.output === 'score' ? simulateDeclarativeGw2Score(options) : simulateDeclarativeGw2(options);
}
