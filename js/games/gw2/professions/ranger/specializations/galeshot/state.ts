import {
  createDiscreteResourceClock,
  type DiscreteResourceClock,
  type ResourcePolicy
} from '#gw2/platform/combat/resources/resource-policy.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { RangerConfig, RangerState } from '#gw2/professions/ranger/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface GaleshotState {
  cycloneBowActive: boolean;
  arrows: DiscreteResourceClock;
  windForce: number;
  galeForceUntil: number;
  mistralUntil: number;
  mistralPathOfScars: Record<string, boolean>;
  wutheringWindReady: boolean;
  wutheringWindReadyAt: number;
  wutheringWindActivationIds: Record<string, boolean>;
  thrillOfTheCatchReadyAt: number;
  flockTogetherReadyAt: number;
  missileHits: number;
}

// Galeshot owns its public Cyclone Bow and wind-resource projection.
export const GALESHOT_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  cycloneBowActive: false,
  arrows: createDiscreteResourceClock(8),
  windForce: 0,
  galeForceUntil: 0,
  mistralUntil: 0,
  wutheringWindReady: false,
  thrillOfTheCatchReadyAt: 0,
  flockTogetherReadyAt: 0,
  missileHits: 0
} satisfies Partial<RangerState>);

function createGaleshotState(config: RangerConfig = {}): GaleshotState {
  return {
    cycloneBowActive: false,
    arrows: createDiscreteResourceClock(boundedNumber(config.initialArrows ?? 8, 8, 0, 8)),
    windForce: 0,
    galeForceUntil: 0,
    mistralUntil: 0,
    // An enhanced axe retains Mistral until its returning contact resolves.
    mistralPathOfScars: {},
    wutheringWindReady: false,
    wutheringWindReadyAt: 0,
    // tracks per-activation-id to prevent double-firing when a multi-hit skill
    // lands several pet-hit tasks for the same cast window
    wutheringWindActivationIds: {},
    thrillOfTheCatchReadyAt: 0,
    flockTogetherReadyAt: 0,
    missileHits: 0
  };
}

export const galeshotState = defineProfessionSpecializationState('Galeshot', createGaleshotState);

/** Fixed-cadence arrows use the selected profile without profession-owned clock advancement. */
export const galeshotArrows: ResourcePolicy<RangerRuntime> = {
  kind: 'discrete',
  state: (context) => galeshotState.from(context).arrows,
  maximum: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks'),
  initial: (context, maximum) => Number(context.config.initialArrows ?? maximum),
  recovery: (context) => ({
    interval: balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'pulseInterval'),
    amount: 1,
    start: 'immediate'
  })
};
