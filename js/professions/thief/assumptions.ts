import {
  createProfessionAssumptionControls,
} from "../../app/profession/assumptions.js";
import {
  THIEF_CORE_ASSUMPTION_CONTROLS,
} from "./core/assumptions.js";
import {
  THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  THIEF_ANTIQUARY_SELECTION_CONTROLS,
} from "./specializations/antiquary/assumptions.js";
import {
  THIEF_DEADEYE_ASSUMPTION_CONTROLS,
} from "./specializations/deadeye/assumptions.js";

export {
  THIEF_CORE_ASSUMPTION_CONTROLS,
  THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
  THIEF_ANTIQUARY_SELECTION_CONTROLS,
  THIEF_DEADEYE_ASSUMPTION_CONTROLS,
};

export const THIEF_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...THIEF_CORE_ASSUMPTION_CONTROLS,
  ...THIEF_DEADEYE_ASSUMPTION_CONTROLS,
  ...THIEF_ANTIQUARY_ASSUMPTION_CONTROLS,
]);
