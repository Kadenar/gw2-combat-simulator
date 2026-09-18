import { thiefBaseMaximumHealth } from '#gw2/professions/thief/core/state.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { ThiefConfig } from '#gw2/professions/thief/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface SpecterState {
  shadowShroudExitReadyAt: number;
  shadowForce: number;
  maximumShadowForce: number;
  shadowForcePoolCapacity: number;
  shadowShroudActive: boolean;
  shadowForceUpdatedAt: number;
  darkSentryReadyAtByAlly: Record<string, number>;
}

// GW2: shadow force pool capacity is 69% of maximum health in absolute HP terms.
const SHADOW_FORCE_HEALTH_MULTIPLIER = 0.69;

export function createSpecterState(config: ThiefConfig = {}): SpecterState {
  const maximumHealth = thiefBaseMaximumHealth(config);
  return {
    shadowForce: boundedNumber(config.initialShadowForce || 0, 0, 0, 100),
    maximumShadowForce: 100,
    shadowForcePoolCapacity: maximumHealth * SHADOW_FORCE_HEALTH_MULTIPLIER,
    shadowShroudActive: false,
    shadowShroudExitReadyAt: 0,
    shadowForceUpdatedAt: 0,
    // Per-ally map so that a barrier given to ally 1 does not lock out ally 2.
    darkSentryReadyAtByAlly: {}
  };
}

export const SPECTER_PUBLIC_END_STATE_KEYS: readonly (keyof SpecterState)[] = Object.freeze([
  'shadowForce',
  'maximumShadowForce',
  'shadowForcePoolCapacity',
  'shadowShroudExitReadyAt',
  'shadowShroudActive'
]);

export const SPECTER_INACTIVE_STATE_DEFAULTS: Readonly<Partial<SpecterState>> = Object.freeze({
  shadowForce: 0,
  maximumShadowForce: 100,
  shadowForcePoolCapacity: 0,
  shadowShroudExitReadyAt: 0,
  shadowShroudActive: false
});

export const specterState = defineProfessionSpecializationState('Specter', createSpecterState);
