import type { SimulationRandomnessConfig } from '../../platform/engine/types.js';
import {
  DEFAULT_SIMULATION_RANDOMNESS,
  SIMULATION_RANDOMNESS_MODES,
  normalizeSimulationRandomness
} from '../../platform/engine/core/simulation-random.js';
import { createProfessionAssumptionControls } from '../profession/assumptions.js';
import type { ProfessionAssumptionControl } from '../profession/types.js';

export type SimulationRandomnessAssumptions = Record<string, unknown>;

export const SIMULATION_RANDOMNESS_ASSUMPTION_KEYS = Object.freeze({
  MODE: 'simulationMode'
});

export const SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS: ReadonlyArray<ProfessionAssumptionControl> =
  createProfessionAssumptionControls([
    {
      key: SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.MODE,
      label: 'Simulation randomness',
      type: 'select',
      defaultValue: DEFAULT_SIMULATION_RANDOMNESS.mode,
      section: 'simulation',
      options: [
        {
          value: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC,
          label: 'Deterministic expected'
        },
        {
          value: SIMULATION_RANDOMNESS_MODES.STOCHASTIC,
          label: 'RNG distribution'
        }
      ]
    }
  ]);

export const DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS: Readonly<SimulationRandomnessAssumptions> = Object.freeze(
  Object.fromEntries(SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS.map((control) => [control.key, control.defaultValue]))
);

export function simulationRandomnessFromAssumptions(
  assumptions: SimulationRandomnessAssumptions = {}
): Readonly<SimulationRandomnessConfig> {
  return normalizeSimulationRandomness({
    mode:
      assumptions[SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.MODE] === SIMULATION_RANDOMNESS_MODES.STOCHASTIC
        ? SIMULATION_RANDOMNESS_MODES.STOCHASTIC
        : SIMULATION_RANDOMNESS_MODES.DETERMINISTIC
  });
}

export function isSimulationRandomnessControl(control: { readonly key?: unknown } | null | undefined): boolean {
  const key = control?.key;
  return typeof key === 'string' && key === SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.MODE;
}
