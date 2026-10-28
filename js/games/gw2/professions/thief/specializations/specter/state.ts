import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { ThiefConfig } from '#gw2/professions/thief/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

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

export const specterState = defineProfessionSpecializationState('Specter', createSpecterState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectSpecterPlanningState(input: Gw2PlanningStateInput) {
  const state = specterState.from(input);
  return structuredClone({
    [STATE.SHADOW_CLOCK]: state.shadowClock,
    [STATE.SHADOW_SHROUD_EXIT_READY_AT]: state.shadowShroudExitReadyAt,
    [STATE.SHADOW_SHROUD_ACTIVE]: state.shadowShroudActive
  });
}
