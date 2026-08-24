import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';
import type { GaleshotState, RangerConfig, RangerState } from '../../types.js';

// Galeshot owns its public Cyclone Bow and wind-resource projection.
export const GALESHOT_PUBLIC_END_STATE_KEYS: readonly (keyof RangerState)[] = Object.freeze([
  'cycloneBowActive',
  'arrows',
  'maximumArrows',
  'arrowsUpdatedAt',
  'windForce',
  'galeForceUntil',
  'mistralUntil',
  'wutheringWindReady',
  'thrillOfTheCatchReadyAt',
  'flockTogetherReadyAt',
  'missileHits'
]);

export const GALESHOT_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RangerState>> = Object.freeze({
  cycloneBowActive: false,
  arrows: 0,
  maximumArrows: 8,
  arrowsUpdatedAt: 0,
  windForce: 0,
  galeForceUntil: 0,
  mistralUntil: 0,
  wutheringWindReady: false,
  thrillOfTheCatchReadyAt: 0,
  flockTogetherReadyAt: 0,
  missileHits: 0
});

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
