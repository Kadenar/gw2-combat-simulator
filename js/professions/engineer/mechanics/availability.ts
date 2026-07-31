import { engineerCoreCastAvailability } from "../core/availability.js";
import { amalgamCastAvailability } from "../specializations/amalgam/availability.js";
import { holosmithCastAvailability } from "../specializations/holosmith/availability.js";
import { mechanistCastAvailability } from "../specializations/mechanist/availability.js";
import type {
  AvailabilityResult,
} from "../../../platform/engine/types.js";
import type {
  EngineerPrecastContext,
  EngineerSkill,
} from "../types.js";

const applicationAvailability = Object.freeze([
  engineerCoreCastAvailability,
  holosmithCastAvailability,
  mechanistCastAvailability,
  amalgamCastAvailability,
]);

export function engineerCastAvailability(
  context: EngineerPrecastContext,
  skill: EngineerSkill,
): AvailabilityResult {
  for (const availability of applicationAvailability) {
    const result = availability(context, skill);
    if (result.ready === false) return result;
  }
  return { ready: true };
}
