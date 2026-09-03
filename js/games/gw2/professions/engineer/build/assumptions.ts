import { createProfessionAssumptionControls } from '#gw2/platform/builds/assumptions.js';

/** Keeps Engineer assumption migration and UI controls on the same persisted schema. */
export const ENGINEER_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  {
    key: 'inDamagingField',
    label: 'In damaging field',
    type: 'boolean',
    defaultValue: false,
    specializations: ['Amalgam']
  }
]);
