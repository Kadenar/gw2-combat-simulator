import {
  createProfessionAssumptionControls,
  STANDARD_POSITION_ASSUMPTION_CONTROLS
} from '#gw2/app/profession/assumptions.js';

const RANGER_POSITION_ASSUMPTION_CONTROLS = STANDARD_POSITION_ASSUMPTION_CONTROLS.filter(
  (control) => !['playerHealthPercent', 'targetDistance'].includes(control.key)
);

export const RANGER_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([...RANGER_POSITION_ASSUMPTION_CONTROLS]);
