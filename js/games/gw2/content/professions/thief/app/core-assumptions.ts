import {
  createProfessionAssumptionControls,
  STANDARD_POSITION_ASSUMPTION_CONTROLS
} from '#gw2/app/profession/assumptions.js';

const THIEF_SHARED_ASSUMPTION_CONTROLS = STANDARD_POSITION_ASSUMPTION_CONTROLS.filter(
  (control) => !['playerHealthPercent', 'targetDistance'].includes(control.key)
);

// Stolen skills are runtime palette choices; assumptions retain only shared encounter inputs.
export const THIEF_CORE_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([...THIEF_SHARED_ASSUMPTION_CONTROLS]);
