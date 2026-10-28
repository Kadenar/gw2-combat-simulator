import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/builds/randomness-assumptions.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';

/** Share profession and common assumption defaults between persisted builds and headless configuration. */
export function buildAssumptionControls(
  controls: readonly ProfessionAssumptionControl[] = []
): readonly ProfessionAssumptionControl[] {
  const professionKeys = new Set(controls.map((control) => control.key));
  return [
    ...controls,
    ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS.filter((control) => !professionKeys.has(control.key)),
    ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS.filter((control) => !professionKeys.has(control.key))
  ];
}
