import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { normalizeProcRateOverrides } from '#gw2/platform/builds/proc-rates.js';
import { prepareSelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import type { Gw2SimulationOptions, Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

/**
 * Canonical GW2 simulation entry point.
 *
 * Validate shared inputs once, then execute every profession through the same live runtime.
 */
export function simulateGw2(options: Gw2SimulationOptions & { output: 'score' }): Gw2SimulationScore;
export function simulateGw2(options: Gw2SimulationOptions & { output?: 'detailed' }): Gw2SimulationResult;
export function simulateGw2(
  options: Gw2SimulationOptions & { output?: 'detailed' | 'score' }
): Gw2SimulationResult | Gw2SimulationScore {
  const started = options.onPhase ? performance.now() : 0;
  let config = options.config ?? {};
  if (config.procRateOverrides !== undefined)
    config = { ...config, procRateOverrides: normalizeProcRateOverrides(config.procRateOverrides) };
  if (config.selectedSkills != null)
    config = { ...config, selectedSkills: prepareSelectedSkillLoadout(config.selectedSkills) };
  const profession = options.profession.runtimeFor(config);
  options.onPhase?.('preparation', performance.now() - started);
  return runGw2Runtime({ ...options, profession, config, observation: options.observationPolicy });
}
