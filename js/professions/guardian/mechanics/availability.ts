import type { Skill } from "../../../platform/engine/types.js";
import type { GuardianAvailabilityContext } from "../types.js";

export function selectedGuardianSpecialization(
  context: GuardianAvailabilityContext = {},
): string {
  const config = context.config || context;
  if (typeof config.specialization === "string") {
    return config.specialization;
  }
  return (
    (config.specializations || [])
      .map((value) => (typeof value === "string" ? value : value?.name))
      .find((name) =>
        context.catalog?.specializations?.some(
          (specialization) =>
            specialization.elite && specialization.name === name,
        ),
      ) || ""
  );
}

export function validateGuardianAvailability(
  context: GuardianAvailabilityContext,
  skill: Skill,
): boolean {
  if (!skill.implemented) return false;
  const specialization = selectedGuardianSpecialization(context) || "Core";
  return !(
    skill.type !== "Weapon" &&
    skill.specialization &&
    specialization !== skill.specialization
  );
}
