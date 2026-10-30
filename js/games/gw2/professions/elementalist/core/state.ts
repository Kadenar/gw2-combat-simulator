import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { ElementalistConfig } from '#gw2/professions/elementalist/build/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/** The four elements, in the canonical order every attunement loop iterates. */
export const ELEMENTALIST_ATTUNEMENTS = Object.freeze(['Fire', 'Water', 'Air', 'Earth'] as const);

/** One of the four elements; the key type for every per-attunement record below. */
export type ElementalistAttunement = (typeof ELEMENTALIST_ATTUNEMENTS)[number];

// A negative entry time makes the configured starting attunement pre-dwelled
// while preserving time zero as a real attunement-entry timestamp.
const PRE_DWELLED_ATTUNEMENT_ENTERED_AT = -999999;

/** Live aura type and expiry support aura effects and consumption; attribution stays on the event. */
export interface ElementalistAuraState {
  type: string;
  expiresAt: number;
}

/**
 * The single summoned elemental's lifecycle. Generation counters let stale
 * scheduled actions be discarded when the elemental is resummoned.
 */
interface ElementalistSummonedElementalState {
  element: ElementalistAttunement | null;
  summonGeneration: number;
  actionGeneration: number;
  activeUntil: number;
  busyUntil: number;
  secondaryAttackReadyAt: number;
  currentActivationId: string | null;
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
  freshAirCandidates: number[];
  bountifulPowerProgress: number;
  endurance: ResourceClock;
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
  availableFlips: SkillFlipWindows;
  summonedElemental: ElementalistSummonedElementalState;

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
    endurance: createResourceClock(ENDURANCE.maximum),
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
    availableFlips: {},
    summonedElemental: {
      element: null,
      summonGeneration: 0,
      actionGeneration: 0,
      activeUntil: 0,
      busyUntil: 0,
      secondaryAttackReadyAt: 0,
      currentActivationId: null,
      started: false
    },

    arcaneEchoUntil: 0
  };
}

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectElementalistCorePlanningState(input: Gw2PlanningStateInput) {
  const state = (input.profession as { core: ReturnType<typeof createElementalistCoreState> }).core;
  return structuredClone({
    [STATE.PRIMARY_ATTUNEMENT]: state.primaryAttunement,
    [STATE.ATTUNEMENT_ENTERED_AT]: state.attunementEnteredAt,
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains,
    [STATE.AUTOATTACK_CARRYOVER]: state.autoattackCarryover,
    [STATE.ENDURANCE]: state.endurance,
    [STATE.ACTIVE_AURAS]: state.activeAuras,
    [STATE.PISTOL_BULLETS]: state.pistolBullets,
    [STATE.HAMMER_ORBS]: state.hammerOrbs,
    [STATE.ETCHINGS]: state.etchings,
    [STATE.CONJURE_EQUIPPED]: state.conjureEquipped,
    [STATE.CONJURE_EXPIRES_AT]: state.conjureExpiresAt,
    [STATE.CONJURE_PICKUPS]: state.conjurePickups,
    [STATE.AVAILABLE_FLIPS]: state.availableFlips,
    [STATE.SUMMONED_ELEMENTAL]: state.summonedElemental
  });
}
