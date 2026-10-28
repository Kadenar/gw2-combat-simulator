import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface DruidState {
  pendingHitTimes: number[];
  /** The authored cadence stays separate from its action-tick-rounded delivery. */
  naturalMender: PeriodicTaskState & { deadline: number };
  astralClock: ResourceClock;
  /** A non-null lifetime remains active until its exit task commits, including at the exact deadline. */
  celestialAvatarEndsAt: number | null;
}

/** The resource clock exclusively owns force, capacity, and advancement time. */
export function createDruidState(config: RangerConfig = {}): DruidState {
  return {
    pendingHitTimes: [],
    naturalMender: { ...createPeriodicTaskState(), deadline: Infinity },
    astralClock: {
      value: boundedNumber(config.initialAstralForce ?? 100, 100, 0, 100),
      maximum: 100,
      updatedAt: 0,
      rate: 0
    },
    celestialAvatarEndsAt: null
  };
}

export const druidState = defineProfessionSpecializationState('Druid', createDruidState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectDruidPlanningState(input: Gw2PlanningStateInput) {
  const state = druidState.from(input);
  return structuredClone({
    [STATE.ASTRAL_CLOCK]: state.astralClock,
    [STATE.CELESTIAL_AVATAR_ENDS_AT]: state.celestialAvatarEndsAt
  });
}
