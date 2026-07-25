import {
  calculateCommonAttributes,
} from "../../../platform/gw2/attributes.js";
import {
  applyGuardianBuildAttributeRules,
} from "../build-attributes.js";

export function calculateAttributes(
  build,
  selectedSkills = [],
  weaponSet = 1,
  disabledTrait = null,
) {
  const common = calculateCommonAttributes(build, { weaponSet });
  return applyGuardianBuildAttributeRules(common, {
    build,
    selectedSkills,
    weaponSet,
    disabledTrait,
  });
}

export const calcAttributes = calculateAttributes;
