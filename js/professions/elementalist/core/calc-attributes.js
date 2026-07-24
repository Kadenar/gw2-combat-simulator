import { calculateCommonAttributes } from "../../../platform/gw2/attributes.js";
import * as elementalistGearData from "../data/gear-data.js";
import { applyElementalistBuildAttributeRules } from "../build-attributes.js";

export function calculateAttributes(build, skills) {
  const common = calculateCommonAttributes(build, {
    data: elementalistGearData,
    sigilNames: build.sigils || [],
    dedupeSigils: false,
  });
  return applyElementalistBuildAttributeRules(common, {
    build,
    selectedSkills: skills,
  });
}

export const calcAttributes = calculateAttributes;
