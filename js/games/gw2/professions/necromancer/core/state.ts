import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { cappedResource } from '#gw2/platform/combat/resources/pool.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { projectPublicProfessionState, snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  soulBatteryCapacity,
  vitalPersistenceVitality
} from '#gw2/professions/necromancer/core/traits/soul-reaping/resource-queries.js';
import { spitefulFortitudeVitality } from '#gw2/professions/necromancer/core/traits/spite/behavior.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';

export interface NecromancerSelfCondition {
  readonly condition: string;
  readonly stacks: number;
  readonly duration?: number;
  readonly appliedAt: number;
  readonly expiresAt: number;
}

export interface TasteForBloodGrant extends ChargeGrant {
  readonly at: number;
}

export interface NecromancerCoreState {
  endurance: ResourceClock;
  lifeForce: ResourceClock;
  lifeForceWakeGeneration: number;
  /** Readiness reads the next actual passive wake without crediting a future grant. */
  passiveNextAt: Record<string, number>;
  lifeForceCostMultiplier: number;
  activeShroud: string;
  activeShroudEntryId?: SkillId | null;
  activeShroudExitId?: SkillId | null;
  activeShroudProfileId?: string;
  soulShardGrant: ChargeGrant;
  carapaceExpiries: number[];
  activeMinions: Record<string, number>;
  minionGenerations: Record<string, number>;
  minionAttackGenerations: Record<string, number>;
  /** Actual next attacks survive command pauses without reconstructing progress from elapsed time. */
  minionAttackCursors: Record<
    string,
    {
      cycleIndex: number;
      attackIndex: number;
      skillId: SkillId;
      activationId: string;
      started: boolean;
      busyUntil: number;
      /** Finite horrors retain summon-based expiry while their attack waits for engagement. */
      expiresAt?: number;
    }
  >;
  /** Expiry timestamps for armed flip skills; persistent exits and minion commands use Infinity. */
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  /** Each sword continuation replaces its prior expiry owner. */
  swordChainGeneration: number;
  selfConditions: NecromancerSelfCondition[];
  plagueSendingArmed: boolean;
  lichEndsAt: number;
  /** Re-entering the timed form owns a new cancellable expiry. */
  lichGeneration: number;

  tasteForBloodGrants: Record<string, TasteForBloodGrant[]>;
}

/** Declares the Core fields exposed by every Necromancer end-state projection. */
const NECROMANCER_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'endurance',
  'lifeForce',
  'lifeForceCostMultiplier',
  'activeShroud',
  'soulShardGrant',
  'carapaceExpiries',
  'activeMinions',
  'availableFlips',
  'autoattackChains',
  'selfConditions',
  'lichEndsAt'
] as const satisfies readonly (keyof NecromancerCoreState)[]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const NECROMANCER_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: NECROMANCER_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});

const NECROMANCER_BASE_HEALTH = 9212;

/** Scales fixed Scourge costs onto a 0–100 meter, applying build vitality traits and Soul Battery once. */
export function necromancerLifeForceCostMultiplier(config: NecromancerConfig, balanceContext: unknown): number {
  let vitality = config.stats?.vitality ?? 1000;
  if (!professionStaticRulesApplied(config)) {
    vitality += spitefulFortitudeVitality(config, balanceContext) + vitalPersistenceVitality(config, balanceContext);
  }

  const capacityMultiplier = soulBatteryCapacity(config, balanceContext);
  // Percentage costs require a nonzero capacity; reject invalid tuning before it creates infinite costs.
  if (capacityMultiplier <= 0) throw new RangeError('Life-force capacity multiplier must be positive.');
  return NECROMANCER_BASE_HEALTH / ((NECROMANCER_BASE_HEALTH + Math.max(0, vitality) * 10) * 0.69 * capacityMultiplier);
}

/** Converts a base-health percentage cost into the normalized life-force resource scale. */
export function normalizedNecromancerLifeForceCost(
  state: Pick<NecromancerCoreState, 'lifeForceCostMultiplier'>,
  baseHealthPercent: number
): number {
  return Math.max(0, baseHealthPercent || 0) * state.lifeForceCostMultiplier;
}

/** Converts a base-health percentage into its raw life-force pool cost. */
export function actualNecromancerLifeForceCost(baseHealthPercent: number): number {
  return (NECROMANCER_BASE_HEALTH * Math.max(0, baseHealthPercent || 0)) / 100;
}

/** Publishes detached, current public values without mutating the live module state. */
export function projectNecromancerPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as NecromancerCoreState;
  state.lifeForce.value = cappedResource(state.lifeForce.value, state.lifeForce.maximum);
  return projectPublicProfessionState(
    state,
    NECROMANCER_CORE_PUBLIC_STATE_PROJECTION.keys,
    NECROMANCER_CORE_PUBLIC_STATE_PROJECTION.defaults
  );
}
