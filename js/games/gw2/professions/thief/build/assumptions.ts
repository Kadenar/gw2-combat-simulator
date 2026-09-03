import { createProfessionAssumptionControls } from '#gw2/platform/builds/assumptions.js';
import { THIEF_CORE_ASSUMPTION_CONTROLS } from '#gw2/professions/thief/build/core-assumptions.js';
import {
  THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  THIEF_ANTIQUARY_SELECTION_CONTROLS
} from '#gw2/professions/thief/build/antiquary-assumptions.js';

export { THIEF_CORE_ASSUMPTION_CONTROLS, THIEF_ANTIQUARY_ASSUMPTION_CONTROLS, THIEF_ANTIQUARY_SELECTION_CONTROLS };

export const THIEF_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...THIEF_CORE_ASSUMPTION_CONTROLS,
  ...THIEF_ANTIQUARY_ASSUMPTION_CONTROLS
]);
