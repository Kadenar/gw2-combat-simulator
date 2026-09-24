import type { SimulationRandomnessConfig } from '#kernel/core/simulation-random.js';
import {
  DEFAULT_SIMULATION_RANDOMNESS,
  SIMULATION_RANDOMNESS_MODES,
  normalizeSimulationRandomness
} from '#kernel/core/simulation-random.js';
import { createProfessionAssumptionControls } from '#gw2/platform/builds/assumptions.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';

export type SimulationRandomnessAssumptions = Record<string, unknown>;

const SIMULATION_RANDOMNESS_ASSUMPTION_KEYS = Object.freeze({
  MODE: 'simulationMode',
  SEED: 'simulationSeed'
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
          label: 'Deterministic seeded'
        },
        {
          value: SIMULATION_RANDOMNESS_MODES.STOCHASTIC,
          label: 'RNG distribution'
        }
      ]
    },
    // Persist the seed as a build assumption so shared builds reproduce the same proc rolls.
    {
      key: SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.SEED,
      label: 'Simulation seed',
      type: 'number',
      defaultValue: DEFAULT_SIMULATION_RANDOMNESS.seed,
      minimum: 0,
      maximum: 0xffff_ffff,
      step: 1,
      section: 'simulation'
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
        : SIMULATION_RANDOMNESS_MODES.DETERMINISTIC,
    seed: Number(assumptions[SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.SEED] ?? DEFAULT_SIMULATION_RANDOMNESS.seed)
  });
}

export function isSimulationRandomnessControl(control: { readonly key?: unknown } | null | undefined): boolean {
  const key = control?.key;
  return typeof key === 'string' && key === SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.MODE;
}
