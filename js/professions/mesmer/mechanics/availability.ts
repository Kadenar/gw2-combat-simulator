/**
 * Stable application-facing availability facade.
 * Runtime ownership lives in Core and the active specialization.
 */
import {
  isMesmerContinuumSkillAvailable,
  mesmerAvailability,
} from "../core/availability.js";
import { MECHANIC_SKILLS, SHATTERS } from "./skill-mechanics.js";
import type { MesmerConfig, MesmerSkill } from "../types.js";

export { isMesmerContinuumSkillAvailable, mesmerAvailability };

export function isMesmerBuildSkillAvailable(
  skill: MesmerSkill,
  config: Pick<MesmerConfig, "specialization" | "weaponmasterTraining">,
): boolean {
  if (skill.ambush) return config.specialization === "Mirage";
  if (skill.id < 0) {
    return (
      !skill.specialization || skill.specialization === config.specialization
    );
  }
  if (skill.environment !== "Terrestrial") return false;
  if (skill.type === "Profession") {
    return (MECHANIC_SKILLS[config.specialization] || []).includes(skill.id);
  }
  if (
    skill.specialization &&
    skill.type !== "Weapon" &&
    skill.specialization !== config.specialization
  ) {
    return false;
  }
  if (
    skill.specialization &&
    skill.type === "Weapon" &&
    !config.weaponmasterTraining &&
    skill.specialization !== config.specialization
  ) {
    return false;
  }
  return true;
}

export function mesmerMinimumResource(skill: MesmerSkill): number {
  return SHATTERS[skill.id]?.kind.startsWith("blade") ? 1 : 0;
}
