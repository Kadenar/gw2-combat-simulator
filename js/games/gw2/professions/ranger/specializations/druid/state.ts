import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface DruidState {
  pendingHitTimes: number[];
  /** The authored cadence stays separate from its action-tick-rounded delivery. */
  naturalMender: PeriodicTaskState & { deadline: number };
  astralClock: ResourceClock;
  /** A non-null lifetime remains active until its exit task commits, including at the exact deadline. */
  celestialAvatarEndsAt: number | null;
}

/** The resource clock exclusively owns force, capacity, and advancement time. */
function createDruidState(config: RangerConfig = {}): DruidState {
  return {
    pendingHitTimes: [],
    naturalMender: { ...createPeriodicTaskState(), deadline: Infinity },
    astralClock: {
      value: boundedNumber(config.initialAstralForce ?? 100, 100, 0, 100),
      maximum: 100,
      updatedAt: 0,
      unitsPerSecond: 0
    },
    celestialAvatarEndsAt: null
  };
}

export const druidState = defineProfessionSpecializationState('Druid', createDruidState);

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectDruidPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = druidState.from(input.profession);
  return {
    [STATE.ASTRAL_CLOCK]: state.astralClock,
    [STATE.CELESTIAL_AVATAR_ENDS_AT]: state.celestialAvatarEndsAt
  };
}
