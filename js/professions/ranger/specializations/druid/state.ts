import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';
import type { DruidState, RangerConfig } from '../../types.js';

export function createDruidState(config: RangerConfig = {}): DruidState {
  return {
    astralForce: Math.max(0, Math.min(100, Number(config.initialAstralForce ?? 100))),
    maximumAstralForce: 100,
    celestialAvatarActive: false,
    celestialAvatarEndsAt: 0,
    // Tracks when astral force was last written so advance() can compute elapsed time correctly
    astralForceUpdatedAt: 0,
    // Natural Mender ticks every 3s; start at 3 so the first tick happens at t=3 not t=0
    naturalMenderReadyAt: 3
  };
}

export const druidState = defineProfessionSpecializationState('Druid', createDruidState);
