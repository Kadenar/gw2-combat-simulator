import {
  createProfessionAssumptionControls,
  STANDARD_HITBOX_SIZE_ASSUMPTION_CONTROL
} from '#gw2/platform/builds/assumptions.js';

// Exposes target size because several Revenant ground effects can overlap a large target more times.
export const REVENANT_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  STANDARD_HITBOX_SIZE_ASSUMPTION_CONTROL
]);
