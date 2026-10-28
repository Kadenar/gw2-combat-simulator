import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  createDiscreteResourceClock,
  createResourceClock,
  type DiscreteResourceClock
} from '#gw2/platform/combat/resources/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface GaleshotState {
  cycloneBowActive: boolean;
  arrows: DiscreteResourceClock;
  windForce: ResourceClock;
  galeForceUntil: number;
  mistralUntil: number;
  mistralPathOfScars: Record<string, boolean>;

  missileHits: number;
}

function createGaleshotState(config: RangerConfig = {}): GaleshotState {
  return {
    cycloneBowActive: false,
    arrows: createDiscreteResourceClock(boundedNumber(config.initialArrows ?? 8, 8, 0, 8)),
    windForce: createResourceClock(),
    galeForceUntil: 0,
    mistralUntil: 0,
    // An enhanced axe retains Mistral until its returning contact resolves.
    mistralPathOfScars: {},

    missileHits: 0
  };
}

export const galeshotState = defineProfessionSpecializationState('Galeshot', createGaleshotState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectGaleshotPlanningState(input: Gw2PlanningStateInput) {
  const state = galeshotState.from(input);
  return structuredClone({
    [STATE.CYCLONE_BOW_ACTIVE]: state.cycloneBowActive,
    [STATE.ARROWS]: state.arrows,
    [STATE.WIND_FORCE]: state.windForce,
    [STATE.GALE_FORCE_UNTIL]: state.galeForceUntil,
    [STATE.MISTRAL_UNTIL]: state.mistralUntil,
    [STATE.MISSILE_HITS]: state.missileHits
  });
}
