import { thiefBaseMaximumHealth } from '../../core/state.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';
import type { SpecterState, ThiefConfig } from '../../types.js';

// GW2: shadow force pool capacity is 69% of maximum health in absolute HP terms.
const SHADOW_FORCE_HEALTH_MULTIPLIER = 0.69;

export function createSpecterState(config: ThiefConfig = {}): SpecterState {
  const maximumHealth = thiefBaseMaximumHealth(config);
  return {
    shadowForce: Math.max(0, Math.min(100, Number(config.initialShadowForce || 0))),
    maximumShadowForce: 100,
    shadowForcePoolCapacity: maximumHealth * SHADOW_FORCE_HEALTH_MULTIPLIER,
    shadowShroudActive: false,
    shadowForceUpdatedAt: 0,
    darkSentryReadyAt: 0,
    // Per-ally map so that a barrier given to ally 1 does not lock out ally 2.
    darkSentryReadyAtByAlly: {}
  };
}

export const SPECTER_PUBLIC_END_STATE_KEYS: readonly (keyof SpecterState)[] = Object.freeze([
  'shadowForce',
  'maximumShadowForce',
  'shadowForcePoolCapacity',
  'shadowShroudActive',
  'darkSentryReadyAt'
]);

export const SPECTER_INACTIVE_STATE_DEFAULTS: Readonly<Partial<SpecterState>> = Object.freeze({
  shadowForce: 0,
  maximumShadowForce: 100,
  shadowForcePoolCapacity: 0,
  shadowShroudActive: false,
  darkSentryReadyAt: 0
});

export const specterState = defineProfessionSpecializationState('Specter', createSpecterState);
