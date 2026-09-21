import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface DruidState {
  astralClock: ResourceClock;
  astralForce: number;
  maximumAstralForce: number;
  celestialAvatarActive: boolean;
  celestialAvatarEndsAt: number;
  astralForceUpdatedAt: number;
  naturalMenderReadyAt: number;
}

// Druid owns its public Celestial Avatar resource projection.
export const DRUID_PUBLIC_END_STATE_KEYS: readonly (keyof RangerState)[] = Object.freeze([
  'astralForce',
  'maximumAstralForce',
  'celestialAvatarActive',
  'celestialAvatarEndsAt'
]);

export const DRUID_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RangerState>> = Object.freeze({
  astralForce: 0,
  maximumAstralForce: 100,
  celestialAvatarActive: false,
  celestialAvatarEndsAt: 0
});

export function createDruidState(config: RangerConfig = {}): DruidState {
  return {
    astralClock: {
      value: boundedNumber(config.initialAstralForce ?? 100, 100, 0, 100),
      maximum: 100,
      updatedAt: 0,
      rate: 0
    },
    // Compatibility projections read the shared clock; resource progress has only one mutable owner.
    get astralForce() {
      return this.astralClock.value;
    },
    set astralForce(value: number) {
      this.astralClock.value = value;
    },
    get maximumAstralForce() {
      return this.astralClock.maximum;
    },
    set maximumAstralForce(value: number) {
      this.astralClock.maximum = value;
    },
    celestialAvatarActive: false,
    celestialAvatarEndsAt: 0,
    // Tracks when astral force was last written so advance() can compute elapsed time correctly
    get astralForceUpdatedAt() {
      return this.astralClock.updatedAt;
    },
    set astralForceUpdatedAt(value: number) {
      this.astralClock.updatedAt = value;
    },
    // Natural Mender ticks every 3s; start at 3 so the first tick happens at t=3 not t=0
    naturalMenderReadyAt: 3
  };
}

export const druidState = defineProfessionSpecializationState('Druid', createDruidState);
