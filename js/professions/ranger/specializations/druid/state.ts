import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { DruidState, RangerConfig } from "../../types.js";

export function createDruidState(config: RangerConfig = {}): DruidState {
  return {
    astralForce: Math.max(
      0,
      Math.min(100, Number(config.initialAstralForce ?? 100)),
    ),
    maximumAstralForce: 100,
    celestialAvatarActive: false,
    celestialAvatarEndsAt: 0,
    astralForceUpdatedAt: 0,
    naturalMenderReadyAt: 3,
  };
}

export const druidState = defineProfessionSpecializationState(
  "Druid",
  createDruidState,
);
