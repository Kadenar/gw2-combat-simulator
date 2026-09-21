import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait, normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_TRAIT_IDS } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { registerNecromancerResolverFields } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { boundedNumber, clamp, finiteNumber } from '#kernel/core/numeric.js';

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
  lifeForce: number;
  maximumLifeForce: number;
  maximumHealth: number;
  lifeForcePoolCapacity: number;
  activeShroud: string;
  activeShroudEntryId?: SkillId | null;
  activeShroudExitId?: SkillId | null;
  activeShroudProfileId?: string;
  lastResourceAt: number;
  soulShardGrant: ChargeGrant;
  carapaceExpiries: number[];
  activeMinions: Record<string, number>;
  minionGenerations: Record<string, number>;
  minionAttackGenerations: Record<string, number>;
  minionAttackAnchors: Record<string, number>;
  minionAttackCycleOffsets: Record<string, number>;
  /** Expiry timestamps for armed flip skills; persistent exits and minion commands use Infinity. */
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  selfConditions: NecromancerSelfCondition[];
  plagueSendingArmed: boolean;
  plagueSendingEntrySkillId: SkillId | null;
  lichEndsAt: number;
  pendingShroudEntryId?: SkillId | null;
  signetNextLifeForceAt: number;
  vampirismNextAt: number;
  targetChilledUntil: number;
  targetControlledUntil: number;
  dreadUntil: number;
  fearOfDeathReadyAt: number;
  vampiricPresenceReadyAt: number;
  barbedPrecisionProgress: number;
  traitProcReadyAt: Record<string, number>;
  tasteForBloodBuffs: Record<string, NecromancerTasteForBloodApplication[]>;
}

/** Declares the Core fields exposed by every Necromancer end-state projection. */
export const NECROMANCER_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'lifeForce',
  'maximumLifeForce',
  'maximumHealth',
  'lifeForcePoolCapacity',
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

export const NECROMANCER_BASE_HEALTH = 9212;

/** Calculates maximum health after Core vitality traits that were not already applied by the build layer. */
function necromancerMaximumHealth(config: NecromancerConfig, traits: ReadonlySet<string | number>): number {
  let vitality = Number(config.stats?.vitality ?? config.attributes?.vitality ?? 1000);
  if (!professionStaticRulesApplied(config)) {
    if (hasTrait(traits, NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE)) {
      vitality += Number(config.stats?.power ?? config.attributes?.power ?? 1000) * 0.1;
    }

    if (hasTrait(traits, NECROMANCER_TRAIT_IDS.VITAL_PERSISTENCE)) {
      vitality += 180;
    }
  }

  return NECROMANCER_BASE_HEALTH + Math.max(0, vitality) * 10;
}

/** Converts a base-health percentage cost into the normalized life-force resource scale. */
export function normalizedNecromancerLifeForceCost(
  state: Partial<NecromancerCoreState>,
  baseHealthPercent: number
): number {
  const actualCost = (NECROMANCER_BASE_HEALTH * Math.max(0, Number(baseHealthPercent || 0))) / 100;
  const actualCapacity = Math.max(1, Number(state?.lifeForcePoolCapacity || 1));
  const normalizedCapacity = Math.max(1, Number(state?.maximumLifeForce || 100));
  return (actualCost * normalizedCapacity) / actualCapacity;
}

/** Converts a base-health percentage into its raw life-force pool cost. */
export function actualNecromancerLifeForceCost(baseHealthPercent: number): number {
  return (NECROMANCER_BASE_HEALTH * Math.max(0, Number(baseHealthPercent || 0))) / 100;
}

/** Clamps the canonical life-force value to the build's capacity. */
export function syncNecromancerResources<TState extends NecromancerCoreState>(state: TState): TState {
  state.lifeForce = boundedNumber(state.lifeForce || 0, 0, 0, finiteNumber(state.maximumLifeForce || 100, 100));
  return state;
}

/** Creates fresh Core Necromancer resources, transforms, summons, and trait proc state from a build config. */
export function createNecromancerCoreState(config: NecromancerConfig = {}): NecromancerCoreState {
  // Normalize canonical selected IDs once for all initial state calculations.
  const traits = normalizeSelectedTraitIds(config.selectedTraitIds);
  const soulBattery = hasTrait(traits, NECROMANCER_TRAIT_IDS.SOUL_BATTERY);
  const maximumLifeForce = soulBattery ? 120 : 100;
  const maximumHealth = necromancerMaximumHealth(config, traits);
  const lifeForcePoolCapacity = maximumHealth * 0.69 * (soulBattery ? 1.2 : 1);
  const configuredLifeForce = Number(config.initialResource ?? 100);
  const lifeForce = (maximumLifeForce * clamp(configuredLifeForce, 0, 100)) / 100;
  // Seed every mutable subsystem independently and bound the initial life-force value.
  const state: NecromancerCoreState = syncNecromancerResources({
    lifeForce,
    maximumLifeForce,
    maximumHealth,
    lifeForcePoolCapacity,
    activeShroud: '',
    activeShroudEntryId: null,
    activeShroudExitId: null,
    activeShroudProfileId: '',
    lastResourceAt: 0,
    soulShardGrant: grantCharges(0, 0),
    carapaceExpiries: [],
    activeMinions: {},
    minionGenerations: {},
    minionAttackGenerations: {},
    minionAttackAnchors: {},
    minionAttackCycleOffsets: {},
    availableFlips: {},
    autoattackChains: {},
    selfConditions: [],
    plagueSendingArmed: false,
    plagueSendingEntrySkillId: null,
    lichEndsAt: 0,
    signetNextLifeForceAt: 3,
    vampirismNextAt: 3,
    targetChilledUntil: 0,
    targetControlledUntil: 0,
    dreadUntil: 0,
    fearOfDeathReadyAt: 0,
    vampiricPresenceReadyAt: 0,
    barbedPrecisionProgress: 0.5,
    traitProcReadyAt: {},
    tasteForBloodBuffs: {}
  });
  registerNecromancerResolverFields(state, [
    'targetChilledUntil',
    'targetControlledUntil',
    'dreadUntil',
    'fearOfDeathReadyAt',
    'vampiricPresenceReadyAt',
    'barbedPrecisionProgress',
    'traitProcReadyAt',
    'tasteForBloodBuffs'
  ]);
  return state;
}
