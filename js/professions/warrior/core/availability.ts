import { professionCoreState } from "../../../platform/engine/profession.js";
import type { AvailabilityResult } from "../../../platform/engine/types.js";
import type { WarriorCastContext, WarriorSkill } from "../types.js";

export function warriorCastAvailability(
  context: WarriorCastContext,
  skill: WarriorSkill,
): AvailabilityResult {
  const state = professionCoreState(context);
  const specialization = String(context.config.specialization || "Core");
  if (skill.primalBurst) {
    const active =
      context.state.profession.specialization.kind === "Berserker" &&
      context.state.profession.specialization.state.berserkActive;
    if (!active) {
      return {
        ready: false,
        retryAt: null,
        code: "warrior.berserk",
        reason: "Primal bursts require berserk mode.",
      };
    }
  }
  if (skill.handlerId === "warrior.berserk" && specialization !== "Berserker") {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.specialization",
      reason: "Berserk requires the Berserker specialization.",
    };
  }
  if (skill.burst && specialization === "Bladesworn" && !skill.dragonSlash) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.flow",
      reason: "Bladesworn replaces weapon bursts with Dragon Slash.",
    };
  }
  const cost = Number(skill.adrenalineCost || 0);
  if (cost > Number(state.adrenaline || 0) + context.epsilon) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.adrenaline",
      reason: `${skill.name} requires ${cost} adrenaline.`,
    };
  }
  return { ready: true };
}
