import type { ActivationClaims } from '#gw2/platform/combat/activation-claims.js';
import {
  createDiscreteResourceClock,
  createResourceClock,
  type DiscreteResourceClock,
  type ResourcePolicy
} from '#gw2/platform/combat/resources/resource-policy.js';
import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';

export interface GaleshotState {
  cycloneBowActive: boolean;
  arrows: DiscreteResourceClock;
  windForce: ResourceClock;
  galeForceUntil: number;
  mistralUntil: number;
  mistralPathOfScars: Record<string, boolean>;
  wutheringWindReady: boolean;
  wutheringWindReadyAt: number;
  galeshotActivationClaims: ActivationClaims;

  missileHits: number;
}

// Galeshot owns its public Cyclone Bow and wind-resource projection.
export const GALESHOT_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  cycloneBowActive: false,
  arrows: createDiscreteResourceClock(8),
  windForce: createResourceClock(),
  galeForceUntil: 0,
  mistralUntil: 0,
  wutheringWindReady: false,

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
    wutheringWindReady: false,
    wutheringWindReadyAt: 0,
    // tracks per-activation-id to prevent double-firing when a multi-hit skill
    // lands several pet-hit tasks for the same cast window
    galeshotActivationClaims: {},

    missileHits: 0
  };
}

export const galeshotState = defineProfessionSpecializationState('Galeshot', createGaleshotState);

/** Wind Force starts empty; owned cast-relative tasks grant it without passive recovery. */
export const galeshotWindForce: ResourcePolicy<RangerRuntime> = {
  kind: 'continuous',
  state: (context) => galeshotState.from(context).windForce,
  maximum: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'minimumStacks'),
  initial: () => 0,
  recovery: () => 0
};

/** Fixed-cadence arrows use the selected profile without profession-owned clock advancement. */
export const galeshotArrows: ResourcePolicy<RangerRuntime> = {
  kind: 'discrete',
  state: (context) => galeshotState.from(context).arrows,
  maximum: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks'),
  initial: (context, maximum) => context.config.initialArrows ?? maximum,
  recovery: (context) => ({
    interval: balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'pulseInterval'),
    amount: 1,
    start: 'immediate'
  })
};
