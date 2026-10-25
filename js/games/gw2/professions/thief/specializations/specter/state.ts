import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { ThiefConfig, ThiefState } from '#gw2/professions/thief/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** A Rot Wallow Venom batch keeps its barrier's cause, which parents the Torment each charge pays for. */
export interface RotWallowVenomBatch extends ChargeGrant {
  readonly cause: Gw2ResolverEvent | null;
}

export interface SpecterState {
  shadowShroudExitReadyAt: number;
  shadowClock: ResourceClock;
  shadowShroudActive: boolean;
  /** Each assumed ally's Rot Wallow Venom batches, keyed by ally index; the allied controller supplies strikes. */
  rotWallowVenom: Record<number, RotWallowVenomBatch[]>;
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
    rotWallowVenom: {}
  };
}

// Only active Specter state contributes a resource clock to public projections.
export const SPECTER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  shadowClock: undefined,
  shadowShroudExitReadyAt: 0,
  shadowShroudActive: false
} satisfies Partial<ThiefState>);

export const specterState = defineProfessionSpecializationState('Specter', createSpecterState);
