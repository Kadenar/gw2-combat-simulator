import {
  createProfessionAssumptionControls,
  STANDARD_POSITION_ASSUMPTION_CONTROLS
} from '#gw2/platform/builds/assumptions.js';

// Stolen skills are runtime palette choices; assumptions retain only shared encounter inputs.
export const THIEF_CORE_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...STANDARD_POSITION_ASSUMPTION_CONTROLS
]);
