import {
  createCalculateAttributes,
} from "../../../platform/gw2/attributes.js";
import {
  applyEngineerBuildAttributeRules,
} from "../build-attributes.js";

export const calculateAttributes = createCalculateAttributes(
  applyEngineerBuildAttributeRules,
);

