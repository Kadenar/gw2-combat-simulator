import { calculateCommonAttributes } from "../../../platform/gw2/attributes.js";
import { applyMesmerBuildAttributeRules } from "../build-attributes.js";

export function calculateAttributes(
  build,
  selectedSkills = [],
  weaponSet = 1,
  disabledTrait = null,
) {
  const common = calculateCommonAttributes(build, { weaponSet });
  return applyMesmerBuildAttributeRules(common, {
    build,
    selectedSkills,
    disabledTrait,
  });
}

export const calcAttributes = calculateAttributes;
