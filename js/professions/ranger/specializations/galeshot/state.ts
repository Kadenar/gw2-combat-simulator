import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';
import type { GaleshotState, RangerConfig } from '../../types.js';

export function createGaleshotState(config: RangerConfig = {}): GaleshotState {
  return {
    cycloneBowActive: false,
    arrows: Math.max(0, Math.min(8, Number(config.initialArrows ?? 8))), // clamped so a bad preset can't exceed the cap
    maximumArrows: 8,
    arrowsUpdatedAt: 0,
    windForce: 0,
    galeForceUntil: 0,
    mistralUntil: 0,
    wutheringWindReady: false,
    wutheringWindReadyAt: 0,
    // tracks per-activation-id to prevent double-firing when a multi-hit skill
    // lands several pet-hit tasks for the same cast window
    wutheringWindActivationIds: {},
    thrillOfTheCatchReadyAt: 0,
    flockTogetherReadyAt: 0,
    missileHits: 0
  };
}

export const galeshotState = defineProfessionSpecializationState('Galeshot', createGaleshotState);
