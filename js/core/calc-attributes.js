import { calculateCommonAttributes } from "../platform/gw2/attributes.js";
import { applyMesmerBuildAttributeRules } from "../professions/mesmer/build-attributes.js";

// Compatibility wrapper retained for existing consumers.
export function calcAttributes(
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
