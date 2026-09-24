import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface GaleshotState {
  cycloneBowActive: boolean;
  arrows: number;
  maximumArrows: number;
  /** Next fixed-cadence grant; initialized from the resource profile on first advancement. */
  nextArrowAt: number | null;
  windForce: number;
  galeForceUntil: number;
  mistralUntil: number;
  wutheringWindReady: boolean;
  wutheringWindReadyAt: number;
  wutheringWindActivationIds: Record<string, boolean>;
  thrillOfTheCatchReadyAt: number;
  flockTogetherReadyAt: number;
  missileHits: number;
}

// Galeshot owns its public Cyclone Bow and wind-resource projection.
export const GALESHOT_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  cycloneBowActive: false,
  arrows: 0,
  maximumArrows: 8,
  nextArrowAt: null,
  windForce: 0,
  galeForceUntil: 0,
  mistralUntil: 0,
  wutheringWindReady: false,
  thrillOfTheCatchReadyAt: 0,
  flockTogetherReadyAt: 0,
  missileHits: 0
} satisfies Partial<RangerState>);

function createGaleshotState(config: RangerConfig = {}): GaleshotState {
  return {
    cycloneBowActive: false,
    arrows: boundedNumber(config.initialArrows ?? 8, 8, 0, 8), // clamped so a bad preset can't exceed the cap
    maximumArrows: 8,
    nextArrowAt: null,
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
