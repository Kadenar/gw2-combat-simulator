import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import { thiefBaseMaximumHealth } from "../../core/state.js";

const SHADOW_FORCE_HEALTH_MULTIPLIER = 0.69;

export function createSpecterState(config = {}) {
  const maximumHealth = thiefBaseMaximumHealth(config);
  return {
    professionSkillId: ID.SIPHON,
    shadowForce: Math.max(
      0,
      Math.min(100, Number(config.initialShadowForce || 0)),
    ),
    maximumShadowForce: 100,
    maximumHealth,
    shadowForcePoolCapacity:
      maximumHealth * SHADOW_FORCE_HEALTH_MULTIPLIER,
    shadowShroudActive: false,
    shadowForceUpdatedAt: 0,
    thievesGuildVariant: "Specter",
  };
}
