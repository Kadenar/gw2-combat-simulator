import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { projectPublicProfessionState } from '#gw2/platform/profession-definition/state.js';
import type { GuardianState } from '#gw2/professions/guardian/types.js';
import { snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import { skillFlipVisible } from '#gw2/platform/execution/skill-flips.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RechargeProgress } from '#gw2/platform/execution/recharge.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';

export interface GuardianCoreState {
  endurance: ResourceClock;
  justiceActiveArmed: boolean;
  justiceHitCount: number;
  justiceActiveBurns: number;
  justicePassiveBurns: number;
  virtueReadyAt: Record<'justice' | 'resolve' | 'courage', number>;
  autoattackChains: Record<string, SkillId>;
  availableFlips: SkillFlipWindows;
  symbolicAvengerExpirations: number[];
  symbolIgnitionStartsAt: number;
  symbolIgnitionUntil: number;

  resolutionUntil: number;
  righteousInstinctsGeneration: number;
  furiousFocusReadyAt: number;
  furiousFocusRecharge: RechargeProgress | null;

  spearIlluminatedArmed: boolean;
  spearIlluminatedUntil: number;
  spearLuminanceUntil: number;
}

// Create a complete Guardian core state with bounded resources and initialized
// virtue, trait, symbol, and flip bookkeeping.
export function createGuardianCoreState(): GuardianCoreState {
  return {
    endurance: createResourceClock(100),
    justiceActiveArmed: false,
    justiceHitCount: 0,
    justiceActiveBurns: 0,
    justicePassiveBurns: 0,
    virtueReadyAt: {
      justice: 0,
      resolve: 0,
      courage: 0
    },
    autoattackChains: {},
    availableFlips: {},
    symbolicAvengerExpirations: [],
    symbolIgnitionStartsAt: -1,
    symbolIgnitionUntil: -1,

    resolutionUntil: 0,
    righteousInstinctsGeneration: 0,
    furiousFocusReadyAt: 0,
    furiousFocusRecharge: null,

    spearIlluminatedArmed: false,
    spearIlluminatedUntil: 0,
    spearLuminanceUntil: 0
  };
}

/** Each Symbolic Avenger stack expires independently, including between symbol hits. */
export function activeSymbolicAvengerExpirations(state: Partial<GuardianCoreState>, at: number): number[] {
  return purgeExpiredStacks(state.symbolicAvengerExpirations || [], at);
}

/** Declares the Core-owned portion of Guardian's stable public end-state contract. */
const GUARDIAN_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof GuardianCoreState)[] = Object.freeze([
  'endurance',

  'justiceActiveArmed',
  'justiceHitCount',
  'justiceActiveBurns',
  'justicePassiveBurns',
  'virtueReadyAt',
  'autoattackChains',
  'availableFlips',
  'symbolIgnitionStartsAt',
  'symbolIgnitionUntil',

  'symbolicAvengerExpirations',

  'resolutionUntil',
  'spearIlluminatedArmed',
  'spearIlluminatedUntil',
  'spearLuminanceUntil'
]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const GUARDIAN_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: GUARDIAN_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});

/** Detaches canonical combat state and expires public windows at the observation time. */
export function snapshotGuardianState(state: unknown, at: number): GuardianState {
  const snapshot = snapshotProfessionState(state) as GuardianState;
  // Snapshots can be captured before a flip's expiry task runs; never expose an expired flip to the palette.
  snapshot.availableFlips = Object.fromEntries(
    Object.entries(snapshot.availableFlips).filter(([, window]) => skillFlipVisible(window, at))
  );
  snapshot.symbolicAvengerExpirations = activeSymbolicAvengerExpirations(snapshot, at);
  return snapshot;
}

/** Publishes detached, current public values without mutating the live module state. */
export function projectGuardianPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotGuardianState(input.profession, input.time);
  return projectPublicProfessionState(
    state,
    GUARDIAN_CORE_PUBLIC_STATE_PROJECTION.keys,
    GUARDIAN_CORE_PUBLIC_STATE_PROJECTION.defaults
  );
}
