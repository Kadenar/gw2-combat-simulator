import { calculateCommonAttributes } from "../../../platform/gw2/attributes.js";
import * as elementalistGearData from "../data/gear-data.js";
import { applyElementalistBuildAttributeRules } from "../build-attributes.js";
import type { Skill } from "../../../platform/engine/types.js";
import type {
  Gw2Build,
  Gw2FinalizedAttributeResult,
} from "../../../platform/gw2/types.js";

export function calculateAttributes(
  build: Gw2Build,
  skills: readonly Skill[] = [],
): Gw2FinalizedAttributeResult {
  const activeWeaponSet = Number(build.startingWeaponSet) === 2 ? 1 : 0;
  const sigils = Array.isArray(build.sigils)
    ? build.sigils.filter((name): name is string => typeof name === "string")
    : Array.isArray(build.weaponSigils?.[activeWeaponSet])
      ? build.weaponSigils[activeWeaponSet].filter(
          (name): name is string => typeof name === "string",
        )
      : [];
  const common = calculateCommonAttributes(build, {
    data: elementalistGearData,
    sigilNames: sigils,
    dedupeSigils: false,
  });
  return applyElementalistBuildAttributeRules(common, {
    build,
    selectedSkills: skills,
  });
}

export const calcAttributes = calculateAttributes;
