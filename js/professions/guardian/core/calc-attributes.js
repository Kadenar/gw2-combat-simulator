import {
  createCalculateAttributes,
} from "../../../platform/gw2/attributes.js";
import {
  applyGuardianBuildAttributeRules,
} from "../build-attributes.js";

export const calculateAttributes = createCalculateAttributes(
  applyGuardianBuildAttributeRules,
);

export const calcAttributes = calculateAttributes;
