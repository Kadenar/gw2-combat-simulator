import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { NECROMANCER_CORE_BALANCE_PROFILES } from '#gw2/professions/necromancer/core/profiles.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait, normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_TRAIT_IDS } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';

import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { clamp } from '#kernel/core/numeric.js';

export interface NecromancerSelfCondition {
  readonly condition: string;
  readonly stacks: number;
  readonly duration?: number;
  readonly appliedAt: number;
  readonly expiresAt: number;
  readonly sourceSkillId?: SkillId;
  readonly sourceSkillName?: string;
}

export interface NecromancerTasteForBloodApplication {
  readonly at: number;
  readonly expiresAt: number;
  stacks: number;
}

export interface NecromancerCoreState {
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
  minionAttackAnchors: Record<string, number>;
  minionAttackCycleOffsets: Record<string, number>;
  /** Actual next attacks survive command pauses without reconstructing progress from elapsed time. */
  minionAttackCursors: Record<string, { cycleIndex: number; attackIndex: number }>;
  /** Expiry timestamps for armed flip skills; persistent exits and minion commands use Infinity. */
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  /** Each sword continuation replaces its prior expiry owner. */
  swordChainGeneration: number;
  selfConditions: NecromancerSelfCondition[];
  plagueSendingArmed: boolean;
  plagueSendingEntrySkillId: SkillId | null;
  lichEndsAt: number;
  /** Re-entering the timed form owns a new cancellable expiry. */
  lichGeneration: number;
  pendingShroudEntryId?: SkillId | null;
  targetChilledUntil: number;
  targetControlledUntil: number;
  dreadUntil: number;
  fearOfDeathReadyAt: number;
  vampiricPresenceReadyAt: number;
  traitProcReadyAt: Record<string, number>;
  tasteForBloodBuffs: Record<string, NecromancerTasteForBloodApplication[]>;
}

/** Declares the Core fields exposed by every Necromancer end-state projection. */
const NECROMANCER_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'lifeForce',
  'lifeForceCostMultiplier',
  'activeShroud',
  'soulShardGrant',
  'carapaceExpiries',
  'activeMinions',
  'availableFlips',
  'autoattackChains',
  'selfConditions',
  'lichEndsAt',
  'dreadUntil'
] as const satisfies readonly (keyof NecromancerCoreState)[]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const NECROMANCER_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: NECROMANCER_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});

const NECROMANCER_BASE_HEALTH = 9212;

/** Scales fixed Scourge costs onto a 0–100 meter, applying build vitality traits and Soul Battery once. */
export function necromancerLifeForceCostMultiplier(
  config: NecromancerConfig,
  balanceContext: unknown = {
    balanceProfile: (id: string | number) => NECROMANCER_CORE_BALANCE_PROFILES.find((profile) => profile.id === id)
  }
): number {
  const traits = normalizeSelectedTraitIds(config.selectedTraitIds);
  let vitality = Number(config.stats?.vitality ?? 1000);
  if (!professionStaticRulesApplied(config)) {
    if (hasTrait(traits, NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE)) {
      const spitefulFortitudeProfile = requireBalanceProfileFromContext(
        balanceContext,
        NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE
      );
      vitality +=
        Number(config.stats?.power ?? 1000) * balanceProfileNumber(spitefulFortitudeProfile, 'attributeConversion');
    }

    if (hasTrait(traits, NECROMANCER_TRAIT_IDS.VITAL_PERSISTENCE)) {
      const vitalPersistenceProfile = requireBalanceProfileFromContext(
        balanceContext,
        NECROMANCER_TRAIT_IDS.VITAL_PERSISTENCE
      );
      vitality += balanceProfileNumber(vitalPersistenceProfile, 'attributeBonus');
    }
  }

  const capacityMultiplier = hasTrait(traits, NECROMANCER_TRAIT_IDS.SOUL_BATTERY)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, NECROMANCER_TRAIT_IDS.SOUL_BATTERY),
        'lifeForceCapacityMultiplier'
      )
    : 1;
  // Percentage costs require a nonzero capacity; reject invalid tuning before it creates infinite costs.
  if (capacityMultiplier <= 0) throw new RangeError('Life-force capacity multiplier must be positive.');
  return NECROMANCER_BASE_HEALTH / ((NECROMANCER_BASE_HEALTH + Math.max(0, vitality) * 10) * 0.69 * capacityMultiplier);
}

/** Converts a base-health percentage cost into the normalized life-force resource scale. */
export function normalizedNecromancerLifeForceCost(
  state: Pick<NecromancerCoreState, 'lifeForceCostMultiplier'>,
  baseHealthPercent: number
): number {
  return Math.max(0, Number(baseHealthPercent || 0)) * state.lifeForceCostMultiplier;
}

/** Converts a base-health percentage into its raw life-force pool cost. */
export function actualNecromancerLifeForceCost(baseHealthPercent: number): number {
  return (NECROMANCER_BASE_HEALTH * Math.max(0, Number(baseHealthPercent || 0))) / 100;
}

/** Creates fresh Core Necromancer resources, transforms, summons, and trait proc state from a build config. */
export function createNecromancerCoreState(config: NecromancerConfig = {}): NecromancerCoreState {
  // Seed every mutable subsystem independently and bound the initial life-force value.
  const state: NecromancerCoreState = {
    lifeForce: { value: clamp(Number(config.initialResource ?? 100), 0, 100), maximum: 100, rate: 0, updatedAt: 0 },
    lifeForceCostMultiplier: necromancerLifeForceCostMultiplier(config),
    lifeForceWakeGeneration: 0,
    passiveNextAt: {},
    activeShroud: '',
    activeShroudEntryId: null,
    activeShroudExitId: null,
    activeShroudProfileId: '',
    soulShardGrant: grantCharges(0, 0),
    carapaceExpiries: [],
    activeMinions: {},
    minionGenerations: {},
    minionAttackGenerations: {},
    minionAttackAnchors: {},
    minionAttackCycleOffsets: {},
    minionAttackCursors: {},
    availableFlips: {},
    autoattackChains: {},
    swordChainGeneration: 0,
    selfConditions: [],
    plagueSendingArmed: false,
    plagueSendingEntrySkillId: null,
    lichEndsAt: 0,
    lichGeneration: 0,
    targetChilledUntil: 0,
    targetControlledUntil: 0,
    dreadUntil: 0,
    fearOfDeathReadyAt: 0,
    vampiricPresenceReadyAt: 0,
    traitProcReadyAt: {},
    tasteForBloodBuffs: {}
  };
  return state;
}
