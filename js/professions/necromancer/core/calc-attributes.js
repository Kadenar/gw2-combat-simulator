import {
  createCalculateAttributes,
} from "../../../platform/gw2/attributes.js";
import {
  applyNecromancerBuildAttributeRules,
} from "../build-attributes.js";

export const calculateAttributes = createCalculateAttributes(
  applyNecromancerBuildAttributeRules,
);

export const calcAttributes = calculateAttributes;
