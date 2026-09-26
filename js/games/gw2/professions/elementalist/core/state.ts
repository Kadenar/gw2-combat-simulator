import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILES,
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS
} from '#gw2/professions/elementalist/core/profiles.js';
import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';

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
  autoattackChains: Record<number, number>;
  autoattackCarryover: {
    root: number;
    attunement: ElementalistAttunement;
  } | null;
  pendingAutoattackCarryover: {
    root: number;
    attunement: ElementalistAttunement;
  } | null;
  freshAirCandidates: Array<{
    at: number;
    eventOrder: number;
  }>;
  bountifulPowerProgress: number;
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
    autoattackChains: {},
    autoattackCarryover: null,
    pendingAutoattackCarryover: null,
    freshAirCandidates: [],
    bountifulPowerProgress: 0,
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

/** Attunement readiness belongs to the shared cooldown controller, including temporary recharge rates. */
export function setElementalistAttunementReadyAt(
  context: ElementalistRuntime,
  attunement: ElementalistAttunement,
  readyAt: number
): void {
  const skill = context.helpers.skillsById.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement]);
  if (!skill) throw new Error('Missing attunement skill.');
  // Keeping an existing deadline must also keep the work already earned under earlier recharge rates.
  if (context.cooldowns.get(skill.id) === readyAt) return;
  if (readyAt > context.time)
    context.cooldownController.startRecharge(
      skill,
      context.time,
      (readyAt - context.time) * context.cooldownController.rate(skill)
    );
  else context.cooldownController.clear(skill.id);
}

/** Resets the actual attunement recharge pools at the shared reset boundary. */
export function resetElementalistAttunementCooldowns(context: ElementalistRuntime): void {
  for (const element of ELEMENTALIST_ATTUNEMENTS) setElementalistAttunementReadyAt(context, element, context.time);
}

// Core declares only the public fields present in every Elementalist runtime.
const ELEMENTALIST_CORE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'primaryAttunement',
  'attunementEnteredAt',
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
