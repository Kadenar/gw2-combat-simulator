import {
  createCalculateAttributes,
} from "../../../platform/gw2/attributes.js";
import {
  applyRevenantBuildAttributeRules,
} from "../build-attributes.js";

export const calculateAttributes = createCalculateAttributes(
  applyRevenantBuildAttributeRules,
);

