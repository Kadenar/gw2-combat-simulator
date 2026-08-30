import { createProfessionAssumptionControls } from '#gw2/app/profession/assumptions.js';

export const THIEF_ANTIQUARY_SELECTION_CONTROLS = Object.freeze([
  {
    key: 'forgedSurferBombsHit',
    label: 'Forged Surfer bombs hit',
    type: 'select',
    defaultValue: '5',
    section: 'Antiquary',
    specializations: ['Antiquary'],
    options: [
      { value: '1', label: '1 bomb' },
      { value: '2', label: '2 bombs' },
      { value: '3', label: '3 bombs' },
      { value: '4', label: '4 bombs' },
      { value: '5', label: '5 bombs (maximum)' }
    ]
  }
]);

export const THIEF_ANTIQUARY_ASSUMPTION_CONTROLS = createProfessionAssumptionControls(
  THIEF_ANTIQUARY_SELECTION_CONTROLS
);
