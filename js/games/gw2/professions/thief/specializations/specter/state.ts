import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { ThiefConfig, ThiefState } from '#gw2/professions/thief/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface SpecterState {
  shadowShroudExitReadyAt: number;
  shadowClock: ResourceClock;
  shadowShroudActive: boolean;
  darkSentryReadyAtByAlly: Record<string, number>;
}

/** Track Shadow Force as a percentage; incoming damage and its health-scaled pool are outside simulation scope. */
function createSpecterState(config: ThiefConfig = {}): SpecterState {
  return {
    shadowClock: {
      value: boundedNumber(config.initialShadowForce || 0, 0, 0, 100),
      maximum: 100,
      updatedAt: 0,
      rate: 0
    },
    shadowShroudActive: false,
    shadowShroudExitReadyAt: 0,
    // Per-ally map so that a barrier given to ally 1 does not lock out ally 2.
    darkSentryReadyAtByAlly: {}
  };
}

// Only active Specter state contributes a resource clock to public projections.
export const SPECTER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  shadowClock: undefined,
  shadowShroudExitReadyAt: 0,
  shadowShroudActive: false
} satisfies Partial<ThiefState>);

export const specterState = defineProfessionSpecializationState('Specter', createSpecterState);
