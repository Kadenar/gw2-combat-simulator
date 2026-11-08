import { normalizeProcRateOverrides } from '#gw2/platform/builds/proc-rates.js';
import type {
  Gw2SimulationObservations,
  Gw2SimulationResult,
  Gw2SimulationScore
} from '#gw2/platform/results/types.js';
import type { Gw2SimulationOptions } from '#gw2/platform/simulation/options.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

/**
 * Canonical GW2 simulation entry point.
 *
 * Validate shared inputs once, then execute every profession through the same live runtime.
 */
export function simulateGw2(options: Gw2SimulationOptions & { output: 'score' }): Gw2SimulationScore;

export function simulateGw2(options: Gw2SimulationOptions & { output: 'observations' }): Gw2SimulationObservations;

export function simulateGw2(options: Gw2SimulationOptions & { output?: 'detailed' }): Gw2SimulationResult;

export function simulateGw2(
  options: Gw2SimulationOptions & { output?: 'detailed' | 'score' | 'observations' }
): Gw2SimulationResult | Gw2SimulationScore | Gw2SimulationObservations {
  const started = options.onPhase ? performance.now() : 0;
  let config = options.config ?? {};

  if (config.procRateOverrides !== undefined)
    config = { ...config, procRateOverrides: normalizeProcRateOverrides(config.procRateOverrides) };

  const profession = options.profession.runtimeFor(config);
  options.onPhase?.('preparation', performance.now() - started);
  return runGw2Runtime({ ...options, profession, config, observation: options.observationPolicy });
}
