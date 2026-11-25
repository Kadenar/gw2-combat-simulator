import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/builds/randomness-assumptions.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';

// Every profession can opt into field hits for effects that retaliate when the player is struck.
const sharedControls: readonly ProfessionAssumptionControl[] = [
  ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS,
  { key: 'inDamagingField', label: 'In damaging field', type: 'boolean', defaultValue: false, section: 'simulation' }
];

/** Use the same controls for the settings panel, saved builds, and headless simulation. */
export function buildAssumptionControls(
  controls: readonly ProfessionAssumptionControl[] = []
): readonly ProfessionAssumptionControl[] {
  const professionKeys = new Set(controls.map((control) => control.key));
  return [...controls, ...sharedControls.filter((control) => !professionKeys.has(control.key))];
}
