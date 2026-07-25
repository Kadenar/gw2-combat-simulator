import {
  createCalculateAttributes,
} from "../../../platform/gw2/attributes.js";
import { applyMesmerBuildAttributeRules } from "../build-attributes.js";

export const calculateAttributes = createCalculateAttributes(
  applyMesmerBuildAttributeRules,
);
