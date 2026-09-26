import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { prepareSimulationConfig } from '#tests/helpers/simulation-config.js';

const observed = new WeakMap();

/** Runs family cases through the composed runtime hooks and records the observed runtime owner. */
export function createObservedProfessionSimulator(profession, baseConfig) {
  return (specialization = baseConfig.specialization ?? 'Core', rotation, overrides = {}, observation) => {
    const config = { ...prepareSimulationConfig(baseConfig, overrides), specialization };
    return observeGw2Runtime({ profession: profession.runtimeFor(config), config, rotation, observation });
  };
}

/** Engine contracts inspect the actual owner through initialization, without exposing internal fields in public results. */
export function observeGw2Runtime(options) {
  let runtime;
  const result = runGw2Runtime({
    ...options,
    profession: {
      ...options.profession,
      initialize(context) {
        runtime = context;
        options.profession.initialize?.(context);
      }
    }
  });
  observed.set(result, runtime);
  return result;
}

/** Returns the owner captured for this exact run; score and detailed calls never share observations. */
export function observedRuntime(result) {
  const runtime = observed.get(result);
  if (!runtime) throw new Error('No runtime observed for this result.');
  return runtime;
}
