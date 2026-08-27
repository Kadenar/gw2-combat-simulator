import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '../data/ids.js';
import type { ElementalistConfig, ElementalistSchedulerContext } from '../types.js';

export const ELEMENTALIST_ATTUNEMENTS = Object.freeze(['Fire', 'Water', 'Air', 'Earth'] as const);

export type ElementalistAttunement = (typeof ELEMENTALIST_ATTUNEMENTS)[number];

// A negative entry time makes the configured starting attunement pre-dwelled
// while preserving time zero as a real attunement-entry timestamp.
export const PRE_DWELLED_ATTUNEMENT_ENTERED_AT = -999999;

export interface ElementalistAuraState {
  type: string;
  appliedAt: number;
  expiresAt: number;
  skillName: string;
}

export interface ElementalistSummonedElementalState {
  element: ElementalistAttunement | null;
  summonGeneration: number;
  actionGeneration: number;
  activeUntil: number;
  busyUntil: number;
  nextActionAt: number;
  secondaryAttackReadyAt: number;
  currentActivationId: string | null;
  pendingLightningJolt: { coefficient: number; skillId: number } | null;
  started: boolean;
}

export interface ElementalistCoreState {
  primaryAttunement: ElementalistAttunement;
  attunementEnteredAt: number;
  attunementReadyAt: Record<ElementalistAttunement, number>;
  autoattackChains: Record<number, number>;
  autoattackCarryover: {
    root: number;
    attunement: ElementalistAttunement;
  } | null;
  pendingAutoattackCarryover: {
    root: number;
    attunement: ElementalistAttunement;
  } | null;
  freshAirProgress: number;
  freshAirLastResetAt: number;
  freshAirCandidates: Array<{
    at: number;
    criticalChance: number;
    eventOrder: number;
    sourceId: string | number;
    sourceSkill: string;
  }>;
  burningPrecisionProgress: number;
  bountifulPowerProgress: number;
  criticalProcProgress: Record<string, number>;
  endurance: number;
  enduranceUpdatedAt: number;
  activeAuras: ElementalistAuraState[];
  pistolBullets: Record<ElementalistAttunement, boolean>;
  dazingDischargeUntil: number;
  shatteringStoneHitsRemaining: number;
  shatteringStoneUntil: number;
  hammerOrbs: Record<ElementalistAttunement, number | null>;
  hammerOrbGrantedBy: Record<ElementalistAttunement, string | null>;
  hammerOrbActivationIds: Record<ElementalistAttunement, string | null>;
  hammerOrbBuffUntil: Record<ElementalistAttunement, number>;
  hammerOrbLastCastAt: number;
  etchings: Record<string, { stage: 'lesser' | 'full'; otherCasts: number } | null>;
  rockBarrierExpiresAt: number;
  spearNextDamageBonus: boolean;
  spearNextRechargeReduction: boolean;
  spearNextGuaranteedCritical: boolean;
  spearNextControlHit: boolean;
  spearFollowups: Record<string, { damage: boolean; critical: boolean; control: boolean }>;
  conjureEquipped: string | null;
  conjurePickups: Record<string, number>;
  signetOfFireDisabledUntil: number;
  availableFlips: Record<string, number>;
  summonedElemental: ElementalistSummonedElementalState;
  procReadyAt: Record<string, number>;
  arcaneEchoUntil: number;
}

export function isElementalistAttunement(value: unknown): value is ElementalistAttunement {
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement);
}

// Build a fully populated core state so every weapon family and specialization
// can mutate shared attunement resources without defensive shape checks.
export function createElementalistCoreState(config: ElementalistConfig = {}): ElementalistCoreState {
  const primary = isElementalistAttunement(config.startAttunement) ? config.startAttunement : 'Fire';
  const configuredBullets =
    config.pistolBullets && typeof config.pistolBullets === 'object'
      ? (config.pistolBullets as Partial<Record<ElementalistAttunement, boolean>>)
      : {};
  return {
    primaryAttunement: primary,
    attunementEnteredAt: PRE_DWELLED_ATTUNEMENT_ENTERED_AT,
    attunementReadyAt: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    autoattackChains: {},
    autoattackCarryover: null,
    pendingAutoattackCarryover: null,
    freshAirProgress: 0,
    freshAirLastResetAt: Number.NEGATIVE_INFINITY,
    freshAirCandidates: [],
    burningPrecisionProgress: 0,
    bountifulPowerProgress: 0,
    criticalProcProgress: {},
    endurance: 100,
    enduranceUpdatedAt: 0,
    activeAuras: [],
    pistolBullets: {
      Fire: Boolean(configuredBullets.Fire),
      Water: Boolean(configuredBullets.Water),
      Air: Boolean(configuredBullets.Air),
      Earth: Boolean(configuredBullets.Earth)
    },
    dazingDischargeUntil: 0,
    shatteringStoneHitsRemaining: 0,
    shatteringStoneUntil: 0,
    hammerOrbs: { Fire: null, Water: null, Air: null, Earth: null },
    hammerOrbGrantedBy: { Fire: null, Water: null, Air: null, Earth: null },
    hammerOrbActivationIds: {
      Fire: null,
      Water: null,
      Air: null,
      Earth: null
    },
    hammerOrbBuffUntil: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    hammerOrbLastCastAt: Number.NEGATIVE_INFINITY,
    etchings: {},
    rockBarrierExpiresAt: 0,
    spearNextDamageBonus: false,
    spearNextRechargeReduction: false,
    spearNextGuaranteedCritical: false,
    spearNextControlHit: false,
    spearFollowups: {},
    conjureEquipped: null,
    conjurePickups: {},
    signetOfFireDisabledUntil: 0,
    availableFlips: {},
    summonedElemental: {
      element: null,
      summonGeneration: 0,
      actionGeneration: 0,
      activeUntil: 0,
      busyUntil: 0,
      nextActionAt: 0,
      secondaryAttackReadyAt: 0,
      currentActivationId: null,
      pendingLightningJolt: null,
      started: false
    },
    procReadyAt: {},
    arcaneEchoUntil: 0
  };
}

export function setElementalistAttunementReadyAt(
  context: ElementalistSchedulerContext,
  attunement: ElementalistAttunement,
  readyAt: number
): void {
  const state = professionCoreState(context);
  state.attunementReadyAt[attunement] = readyAt;
  const schedulerState = context.state as { time?: number; cooldowns?: Map<number, number> } | undefined;
  const cooldowns = schedulerState?.cooldowns;
  if (!cooldowns) return;
  const skillId = ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement];
  if (readyAt > Number(schedulerState.time || 0)) {
    cooldowns.set(skillId, readyAt);
  } else {
    cooldowns.delete(skillId);
  }
}

export function resetElementalistAttunementCooldowns(context: ElementalistSchedulerContext): void {
  const at = Number((context.state as { time?: number } | undefined)?.time || context.time || 0);
  for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
    setElementalistAttunementReadyAt(context, attunement, at);
  }
}

// Core declares only the public fields present in every Elementalist runtime.
export const ELEMENTALIST_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'primaryAttunement',
  'attunementEnteredAt',
  'attunementReadyAt',
  'autoattackChains',
  'autoattackCarryover',
  'endurance',
  'activeAuras',
  'pistolBullets',
  'dazingDischargeUntil',
  'shatteringStoneHitsRemaining',
  'shatteringStoneUntil',
  'hammerOrbs',
  'hammerOrbGrantedBy',
  'hammerOrbBuffUntil',
  'hammerOrbLastCastAt',
  'etchings',
  'rockBarrierExpiresAt',
  'spearNextDamageBonus',
  'spearNextRechargeReduction',
  'spearNextGuaranteedCritical',
  'spearNextControlHit',
  'conjureEquipped',
  'conjurePickups',
  'signetOfFireDisabledUntil',
  'availableFlips',
  'summonedElemental'
] as const satisfies readonly (keyof ElementalistCoreState)[]);
