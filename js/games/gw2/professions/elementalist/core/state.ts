import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILES,
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS
} from '#gw2/professions/elementalist/core/profiles.js';
import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import type { SkillId, CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { CooldownController } from '#gw2/platform/execution/types.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';

/** The four elements, in the canonical order every attunement loop iterates. */
export const ELEMENTALIST_ATTUNEMENTS = Object.freeze(['Fire', 'Water', 'Air', 'Earth'] as const);

/** One of the four elements; the key type for every per-attunement record below. */
export type ElementalistAttunement = (typeof ELEMENTALIST_ATTUNEMENTS)[number];

// A negative entry time makes the configured starting attunement pre-dwelled
// while preserving time zero as a real attunement-entry timestamp.
const PRE_DWELLED_ATTUNEMENT_ENTERED_AT = -999999;

/** One live aura application: what it is, when it landed, and which skill produced it. */
export interface ElementalistAuraState {
  type: string;
  appliedAt: number;
  expiresAt: number;
  skillName: string;
}

/**
 * The single summoned elemental's lifecycle. Generation counters let stale
 * scheduled actions be discarded when the elemental is resummoned.
 */
export interface ElementalistSummonedElementalState {
  element: ElementalistAttunement | null;
  summonGeneration: number;
  actionGeneration: number;
  activeUntil: number;
  busyUntil: number;
  secondaryAttackReadyAt: number;
  currentActivationId: string | null;
  pendingLightningJolt: { coefficient: number; skillId: number } | null;
  started: boolean;
}

/**
 * Mutable per-simulation state shared by every Elementalist weapon and
 * specialization: attunement bookkeeping, trait progress counters, endurance,
 * auras, and the per-weapon resources (pistol bullets, hammer orbs, spear
 * etchings and empowerments, conjures).
 */
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
  shatteringStone: ChargeGrant;
  hammerOrbs: Record<ElementalistAttunement, number | null>;
  hammerOrbActivationIds: Record<ElementalistAttunement, string | null>;
  hammerOrbLastCastAt: number;
  etchings: Record<string, { stage: 'lesser' | 'full'; otherCasts: number; expiresAt: number } | null>;
  spearNextDamageBonus: boolean;
  spearNextRechargeReduction: boolean;
  spearNextGuaranteedCritical: boolean;
  spearNextControlHit: boolean;
  spearFollowups: Record<string, { damage: boolean; critical: boolean; control: boolean }>;
  conjureEquipped: string | null;
  conjureExpiresAt: number;
  conjurePickups: Record<string, number>;
  signetOfFireDisabledUntil: number;
  availableFlips: SkillFlipWindows;
  summonedElemental: ElementalistSummonedElementalState;
  procReadyAt: Record<string, number>;
  arcaneEchoUntil: number;
}

interface ElementalistAttunementCooldownContext {
  readonly state: {
    readonly profession: { readonly core: ElementalistCoreState };
    readonly time?: number;
    readonly cooldowns?: Map<SkillId, number>;
    readonly rechargeProgress?: Map<SkillId, RechargeProgress>;
  };
  readonly time?: number;
  readonly cooldownController?: CooldownController;
  readonly catalog?: CanonicalCatalog;
}

/** Narrows arbitrary config input to a valid attunement before it reaches state. */
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
    freshAirCandidates: [],
    burningPrecisionProgress: 0,
    bountifulPowerProgress: 0,
    criticalProcProgress: {},
    endurance: BASE_MAXIMUM_ENDURANCE,
    enduranceUpdatedAt: 0,
    activeAuras: [],
    pistolBullets: {
      Fire: Boolean(configuredBullets.Fire),
      Water: Boolean(configuredBullets.Water),
      Air: Boolean(configuredBullets.Air),
      Earth: Boolean(configuredBullets.Earth)
    },
    dazingDischargeUntil: 0,
    shatteringStone: grantCharges(0, 0),
    hammerOrbs: { Fire: null, Water: null, Air: null, Earth: null },
    hammerOrbActivationIds: {
      Fire: null,
      Water: null,
      Air: null,
      Earth: null
    },
    hammerOrbLastCastAt: Number.NEGATIVE_INFINITY,
    etchings: {},
    spearNextDamageBonus: false,
    spearNextRechargeReduction: false,
    spearNextGuaranteedCritical: false,
    spearNextControlHit: false,
    spearFollowups: {},
    conjureEquipped: null,
    conjureExpiresAt: 0,
    conjurePickups: {},
    signetOfFireDisabledUntil: 0,
    availableFlips: {},
    summonedElemental: {
      element: null,
      summonGeneration: 0,
      actionGeneration: 0,
      activeUntil: 0,
      busyUntil: 0,
      secondaryAttackReadyAt: 0,
      currentActivationId: null,
      pendingLightningJolt: null,
      started: false
    },
    procReadyAt: {},
    arcaneEchoUntil: 0
  };
}

/**
 * Single write path for an attunement's recharge: updates core state and mirrors
 * the value onto the scheduler cooldown for that attunement's skill so
 * availability and the UI agree.
 */
export function setElementalistAttunementReadyAt(
  context: ElementalistAttunementCooldownContext,
  attunement: ElementalistAttunement,
  readyAt: number
): void {
  const state = professionCoreState(context);
  state.attunementReadyAt[attunement] = readyAt;
  const schedulerState = context.state as { time?: number; cooldowns?: Map<number, number> } | undefined;
  const cooldowns = schedulerState?.cooldowns;
  if (!cooldowns) return;
  const skillId = ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement];
  const at = Number(schedulerState.time || 0);
  const skill = context.catalog?.skillsById.get(skillId);
  if (readyAt === cooldowns.get(skillId)) return;
  if (skill && context.cooldownController && readyAt > at) {
    state.attunementReadyAt[attunement] = context.cooldownController.startRecharge(
      skill,
      at,
      (readyAt - at) * context.cooldownController.rate(skill, at)
    );
    return;
  }

  context.state.rechargeProgress?.delete(skillId);
  if (readyAt > Number(schedulerState.time || 0)) {
    cooldowns.set(skillId, readyAt);
  } else {
    cooldowns.delete(skillId);
  }
}

/** Clears every attunement recharge to now; the Core `onCooldownReset` hook. */
export function resetElementalistAttunementCooldowns(context: ElementalistAttunementCooldownContext): void {
  const at = Number((context.state as { time?: number } | undefined)?.time || context.time || 0);
  for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
    setElementalistAttunementReadyAt(context, attunement, at);
  }
}

// Core declares only the public fields present in every Elementalist runtime.
const ELEMENTALIST_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'primaryAttunement',
  'attunementEnteredAt',
  'attunementReadyAt',
  'autoattackChains',
  'autoattackCarryover',
  'endurance',
  'activeAuras',
  'pistolBullets',
  'dazingDischargeUntil',
  'hammerOrbs',
  'hammerOrbLastCastAt',
  'etchings',
  'spearNextDamageBonus',
  'spearNextRechargeReduction',
  'spearNextGuaranteedCritical',
  'spearNextControlHit',
  'conjureEquipped',
  'conjureExpiresAt',
  'conjurePickups',
  'signetOfFireDisabledUntil',
  'availableFlips',
  'summonedElemental'
] as const satisfies readonly (keyof ElementalistCoreState)[]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const ELEMENTALIST_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: ELEMENTALIST_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});

// Standalone state factories seed from authored data; scheduler initialization selects the active patch.
const BASE_MAXIMUM_ENDURANCE = requireBalanceNumber(
  ELEMENTALIST_CORE_BALANCE_PROFILES.find((profile) => profile.id === ELEMENTALIST_CORE_BALANCE_PROFILE_IDS.resources)!
    .maximumStacks,
  'elementalist resources maximumStacks'
);
