import { prepareSimulationConfig } from '#tests/helpers/simulation-config.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

/** Creates the common profession test runner and preserves nested simulation config defaults. */
export function createProfessionSimulator(profession, baseConfig) {
  return (specialization, rotation, config = {}, observationPolicy = undefined) =>
    simulateGw2({
      profession,
      rotation,
      config: { ...prepareSimulationConfig(baseConfig, config), specialization },
      observationPolicy
    });
}
