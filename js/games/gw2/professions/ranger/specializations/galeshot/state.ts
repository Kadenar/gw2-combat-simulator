import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  createDiscreteResourceClock,
  createResourceClock,
  type DiscreteResourceClock
} from '#gw2/platform/combat/resources/clock.js';
import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/profession-definition/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';
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

// Galeshot owns its public Cyclone Bow and wind-resource projection.
export const GALESHOT_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  cycloneBowActive: false,
  arrows: createDiscreteResourceClock(8),
  windForce: createResourceClock(),
  galeForceUntil: 0,
  mistralUntil: 0,

  missileHits: 0
} satisfies Partial<RangerState>);

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
