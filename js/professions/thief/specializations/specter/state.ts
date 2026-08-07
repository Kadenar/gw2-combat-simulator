import { thiefBaseMaximumHealth } from "../../core/state.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { SpecterState, ThiefConfig } from "../../types.js";

const SHADOW_FORCE_HEALTH_MULTIPLIER = 0.69;

export function createSpecterState(
  config: ThiefConfig = {},
): SpecterState {
  const maximumHealth = thiefBaseMaximumHealth(config);
  return {
    shadowForce: Math.max(
      0,
      Math.min(100, Number(config.initialShadowForce || 0)),
    ),
    maximumShadowForce: 100,
    shadowForcePoolCapacity:
      maximumHealth * SHADOW_FORCE_HEALTH_MULTIPLIER,
    shadowShroudActive: false,
    shadowForceUpdatedAt: 0,
    darkSentryReadyAt: 0,
  };
}

export const specterState = defineProfessionSpecializationState(
  "Specter",
  createSpecterState,
);
