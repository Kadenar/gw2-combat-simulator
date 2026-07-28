import {
  createCalculateAttributes,
} from "../../../platform/gw2/attributes.js";
import {
  applyThiefBuildAttributeRules,
} from "../build-attributes.js";

export const calculateAttributes = createCalculateAttributes(
  applyThiefBuildAttributeRules,
);
