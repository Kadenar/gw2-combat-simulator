import { runGw2Runtime, runRuntime } from '#gw2/platform/simulation/runtime.js';
import { createCombatExecution } from '#gw2/platform/simulation/combat-execution.js';
import { prepareSimulationConfig } from '#tests/helpers/simulation-config.js';

const observed = new WeakMap();

/** Captures real planning verdicts after a minimal, explicitly initialized Core/elite state. */
export function planningFixture(family, config = {}, initialize = () => {}) {
  const profession = family.runtimeFor(config);
  return runGw2Runtime({
    profession: {
      ...profession,
      initialize(runtime) {
        profession.initialize?.(runtime);
        initialize(runtime);
      }
    },
    config,
    rotation: []
  }).planningState;
}

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
  const execution = createCombatExecution(options.profession, options.rotation ?? []);
  const result = runRuntime({
    ...options,
    execution: {
      ...execution,
      initialize(context) {
        runtime = context;
        execution.initialize?.(context);
        // Fixture setup observes the engine owner explicitly; native hooks still receive author capabilities.
        options.engineInitialize?.(context);
        if (options.config?.initialEndurance != null && options.profession.endurance) {
          const maximum = options.profession.endurance.maximum(context.mechanics);
          context.endurance.spend(maximum - Math.min(maximum, Math.max(0, options.config.initialEndurance)));
        }
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

/** Supplies a complete planning input for minimal fixtures through the selected runtime contract. */
export function projectObservedState(family, input) {
  const config = { ...input.config, specialization: input.profession.specialization.kind };
  const runtime = family.runtimeFor(config);
  return runtime.projectPlanningState({ time: 0, activeWeaponSet: 1, catalog: runtime.catalog, ...input, config });
}
