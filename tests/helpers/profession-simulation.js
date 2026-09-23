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

/** Creates the same runner but also counts scheduling passes, exposing when scheduler feedback converges. */
export function createProfessionPassSimulator(profession, baseConfig) {
  return (specialization, rotation, config = {}, observationPolicy = undefined) => {
    let passes = 0;
    const result = simulateGw2({
      profession,
      rotation,
      config: { ...prepareSimulationConfig(baseConfig, config), specialization },
      observationPolicy,
      onPhase: (phase) => {
        if (phase === 'scheduling') passes += 1;
      }
    });
    return { result, passes };
  };
}
