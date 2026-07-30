import {
  createProfessionAssumptionControls,
  normalizeProfessionAssumptions,
  validateProfessionAssumptions,
} from "../profession/assumptions.js";
import {
  DEFAULT_SIMULATION_RANDOMNESS,
  SIMULATION_RANDOMNESS_MODES,
  normalizeSimulationRandomness,
} from "../../platform/engine/simulation-random.js";

/**
 * Persisted assumptions used to select simulation randomness behavior.
 *
 * @typedef {Object<string, *>} SimulationRandomnessAssumptions
 */

/** Stable keys owned by the shared simulation-randomness controls. */
export const SIMULATION_RANDOMNESS_ASSUMPTION_KEYS = Object.freeze({
  MODE: "simulationMode",
});

/**
 * Shared assumption controls for professions that model random trait procs.
 *
 * @type {ReadonlyArray<import("../profession/assumptions.js").ProfessionAssumptionControl>}
 */
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

/**
 * Default persisted values derived from the randomness control definitions.
 *
 * @type {Readonly<SimulationRandomnessAssumptions>}
 */
export const DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS = Object.freeze(
  Object.fromEntries(
    SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS.map((control) => [
      control.key,
      control.defaultValue,
    ]),
  ),
);

/**
 * Normalizes persisted simulation-randomness assumptions.
 *
 * The obsolete `simulationSeed` field is removed because seeds are an internal
 * reproducibility mechanism rather than a user-facing build choice. Unknown
 * assumption fields are otherwise preserved by the shared normalizer.
 *
 * @param {SimulationRandomnessAssumptions} [assumptions={}] Values to normalize.
 * @returns {SimulationRandomnessAssumptions} New normalized assumptions.
 */
export function normalizeSimulationRandomnessAssumptions(assumptions = {}) {
  // Seeds are an internal reproducibility mechanism, not a user-facing build
  // choice. Drop values persisted by the short-lived seeded-run UI.
  const { simulationSeed: _legacySeed, ...currentAssumptions } = assumptions;
  return normalizeProfessionAssumptions(
    currentAssumptions,
    SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  );
}

/**
 * Validates simulation-randomness assumptions without modifying them.
 *
 * @param {SimulationRandomnessAssumptions} [assumptions={}] Values to validate.
 * @returns {string[]} Validation messages, or an empty array when valid.
 */
export function validateSimulationRandomnessAssumptions(assumptions = {}) {
  return validateProfessionAssumptions(
    assumptions,
    SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  );
}

/**
 * Converts persisted assumptions to the engine randomness configuration.
 *
 * Only the user-selected mode crosses this boundary. The engine normalizer
 * supplies the internal default seed.
 *
 * @param {SimulationRandomnessAssumptions} [assumptions={}] Persisted values.
 * @returns {Readonly<{mode: string, seed: number}>} Normalized engine config.
 */
export function simulationRandomnessFromAssumptions(assumptions = {}) {
  return normalizeSimulationRandomness({
    mode: assumptions[SIMULATION_RANDOMNESS_ASSUMPTION_KEYS.MODE],
  });
}

/**
 * Tests whether a profession assumption control belongs to randomness.
 *
 * Config assembly uses this predicate to keep `simulationMode` out of
 * profession-specific deterministic choices.
 *
 * @param {Object | null | undefined} control Assumption control to inspect.
 * @returns {boolean} Whether the control has a shared randomness key.
 */
export function isSimulationRandomnessControl(control) {
  return Object.values(SIMULATION_RANDOMNESS_ASSUMPTION_KEYS).includes(
    control?.key,
  );
}
