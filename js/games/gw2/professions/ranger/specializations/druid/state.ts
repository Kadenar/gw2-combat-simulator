import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface DruidState {
  astralClock: ResourceClock;
  celestialAvatarActive: boolean;
  celestialAvatarEndsAt: number;
}

// Druid owns its public Celestial Avatar resource projection.
export const DRUID_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  astralClock: undefined,
  celestialAvatarActive: false,
  celestialAvatarEndsAt: 0
} satisfies Partial<RangerState>);

/** The resource clock exclusively owns force, capacity, and advancement time. */
export function createDruidState(config: RangerConfig = {}): DruidState {
  return {
    astralClock: {
      value: boundedNumber(config.initialAstralForce ?? 100, 100, 0, 100),
      maximum: 100,
      updatedAt: 0,
      rate: 0
    },
    celestialAvatarActive: false,
    celestialAvatarEndsAt: 0
  };
}

export const druidState = defineProfessionSpecializationState('Druid', createDruidState);
