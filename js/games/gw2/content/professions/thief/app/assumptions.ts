import { createProfessionAssumptionControls } from '#gw2/app/profession/assumptions.js';
import { THIEF_CORE_ASSUMPTION_CONTROLS } from '#gw2/content/professions/thief/app/core-assumptions.js';
import {
  THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  THIEF_ANTIQUARY_SELECTION_CONTROLS
} from '#gw2/content/professions/thief/app/antiquary-assumptions.js';

export { THIEF_CORE_ASSUMPTION_CONTROLS, THIEF_ANTIQUARY_ASSUMPTION_CONTROLS, THIEF_ANTIQUARY_SELECTION_CONTROLS };

export const THIEF_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...THIEF_CORE_ASSUMPTION_CONTROLS,
  ...THIEF_ANTIQUARY_ASSUMPTION_CONTROLS
]);
