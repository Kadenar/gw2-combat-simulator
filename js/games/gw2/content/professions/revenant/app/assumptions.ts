import { createProfessionAssumptionControls } from '../../../../app/profession/assumptions.js';

// Exposes target size because several Revenant ground effects can overlap a large target more times.
export const REVENANT_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  {
    key: 'hitboxSize',
    label: 'Target hitbox',
    type: 'select',
    defaultValue: 'small',
    options: [
      { value: 'large', label: 'Large' },
      { value: 'small', label: 'Small' }
    ],
    section: 'target'
  }
]);
