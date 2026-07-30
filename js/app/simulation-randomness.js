import {
  createProfessionAssumptionControls,
  normalizeProfessionAssumptions,
  validateProfessionAssumptions,
} from "./profession-assumptions.js";
import {
  DEFAULT_SIMULATION_RANDOMNESS,
  SIMULATION_RANDOMNESS_MODES,
  normalizeSimulationRandomness,
} from "../platform/engine/simulation-random.js";

export const SIMULATION_RANDOMNESS_ASSUMPTION_KEYS = Object.freeze({
  MODE: "simulationMode",
});

export const SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS =
  createProfessionAssumptionControls([
    {
      key: SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.MODE,
      label: "Random trait procs",
      type: "select",
      defaultValue: DEFAULT_SIMULATION_RANDOMNESS.mode,
      section: "simulation",
      options: [
        {
          value: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC,
          label: "Deterministic expected",
        },
        {
          value: SIMULATION_RANDOMNESS_MODES.STOCHASTIC,
          label: "RNG distribution",
        },
      ],
    },
  ]);

export const DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS = Object.freeze(
  Object.fromEntries(
    SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS.map((control) => [
      control.key,
      control.defaultValue,
    ]),
  ),
);

export function normalizeSimulationRandomnessAssumptions(assumptions = {}) {
  // Seeds are an internal reproducibility mechanism, not a user-facing build
  // choice. Drop values persisted by the short-lived seeded-run UI.
  const { simulationSeed: _legacySeed, ...currentAssumptions } = assumptions;
  return normalizeProfessionAssumptions(
    currentAssumptions,
    SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  );
}

export function validateSimulationRandomnessAssumptions(assumptions = {}) {
  return validateProfessionAssumptions(
    assumptions,
    SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  );
}

export function simulationRandomnessFromAssumptions(assumptions = {}) {
  return normalizeSimulationRandomness({
    mode: assumptions[SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.MODE],
  });
}

export function isSimulationRandomnessControl(control) {
  return Object.values(SIMULATION_RANDOMNESS_ASSUMPTION_KEYS)
    .includes(control?.key);
}
