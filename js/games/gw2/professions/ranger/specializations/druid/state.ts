import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface DruidState {
  pendingHitTimes: number[];
  naturalMenderAt: number;
  astralClock: ResourceClock;
  /** A non-null lifetime remains active until its exit task commits, including at the exact deadline. */
  celestialAvatarEndsAt: number | null;
}

// Druid owns its public Celestial Avatar resource projection.
export const DRUID_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  astralClock: undefined,
  celestialAvatarEndsAt: null
} satisfies Partial<RangerState>);

/** The resource clock exclusively owns force, capacity, and advancement time. */
export function createDruidState(config: RangerConfig = {}): DruidState {
  return {
    pendingHitTimes: [],
    naturalMenderAt: Infinity,
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
