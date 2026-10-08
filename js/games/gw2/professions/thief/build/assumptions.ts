import { createProfessionAssumptionControls } from '#gw2/platform/builds/assumptions.js';
import { THIEF_CORE_ASSUMPTION_CONTROLS } from '#gw2/professions/thief/build/core-assumptions.js';

export const THIEF_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([...THIEF_CORE_ASSUMPTION_CONTROLS]);
