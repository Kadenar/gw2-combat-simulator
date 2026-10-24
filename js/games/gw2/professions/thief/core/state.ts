import { normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';
import { createStealthState, type StealthState } from '#gw2/platform/combat/stealth.js';
import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import type { ChargePool } from '#gw2/platform/combat/resources/charges.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  thiefInitiativeRegenerationRate,
  thiefStartingInitiative
} from '#gw2/professions/thief/core/mechanics/resources.js';
import { preparednessInitiativeCapacity } from '#gw2/professions/thief/core/traits/trickery/resource-queries.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefConfig } from '#gw2/professions/thief/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';

/** One engine-owned axe capacity is shared by starting state, live acquisition and preview inputs. */
export const MAXIMUM_SPINNING_AXES = 6;

interface ThievesGuildState {
  /** Combat activation starts the parallel streams once per summon. */
  started: boolean;
  readonly ownerId: string;
  readonly expiresAt: number;
}

export interface ThiefCoreState extends StealthState {
  /** Same-tick hostile impacts must reveal a new stealth grant regardless of queue insertion order. */
  lastStealthBreakingStrike: { at: number; skillId: SkillId } | null;
  initiative: ResourceClock;
  hiddenKillerUntil: number;
  /** A singleton choice represents a forced grant or a locked Improvisation reuse. */
  storedStolenSkillIds: SkillId[];
  storedStolenSkillCount: number;
  kneeling: boolean;
  endurance: ResourceClock;
  leadAttackExpirations: number[];
  spearChainStage: number;
  spearPreviousSkillId: SkillId | null;
  spearLastWasFinisher: boolean;
  /** Retain each axe's source so recall repeats that projectile's damage and conditions. */
  spinningAxes: { skillId: SkillId; expiresAt: number }[];
  /** Outgoing projectiles are recallable before landing, but do not occupy grounded slots yet. */
  outboundAxes: { id: string; skillId: SkillId }[];
  venomChargeBatches: ChargePool['grants'];
  activeThievesGuild: ThievesGuildState | null;
  assassinsSignetPassiveDisabledUntil: number;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  activationClaims: ActivationClaims;
  /** Revealed Training excludes only the first landed revealing hit of each stealth activation. */
  revealedTrainingHitActivations: Record<string, true>;

  /** The pending Infiltrator's Signet pulse instant; earlier queued pulses retire themselves. */
  infiltratorsSignetPulseAt: number | null;
  /** The instant a landed strike last broke stealth, claimable by one same-instant stealth attack. */
  strikeBrokeStealthAt: number | null;
  /** The pending scepter continuation expiry; a newer chain step replaces it. */
  scepterChainExpiresAt: number | null;
}

export function selectedThiefTraits(config: ThiefConfig = {}): Set<string | number> {
  // State initialization normalizes the canonical trait-ID selection once.
  return normalizeSelectedTraitIds(config.selectedTraitIds);
}

// Initialize bounded initiative and endurance plus complete stealth, venom,
// preparation, weapon-chain, stolen-skill, and trait bookkeeping.
export function createThiefCoreState(
  config: ThiefConfig,
  preparation: { balanceContext: ProfessionBalanceContext }
): ThiefCoreState {
  // Standalone construction (attribute previews) shares the runtime policy's calculations, so the pool it builds
  // matches the one simulation initializes from the same selected tuning; nobody kneels before combat.
  const context = { ...preparation.balanceContext, config };
  const maximumInitiative = preparednessInitiativeCapacity(context);
  return {
    lastStealthBreakingStrike: null,
    initiative: {
      ...createResourceClock(thiefStartingInitiative(config, context, maximumInitiative)),
      maximum: maximumInitiative,
      rate: thiefInitiativeRegenerationRate({ kneeling: false }, context)
    },
    ...createStealthState(),
    hiddenKillerUntil: 0,
    storedStolenSkillIds: [],
    storedStolenSkillCount: 0,
    kneeling: false,
    endurance: createResourceClock(100),
    leadAttackExpirations: [],
    spearChainStage: 0,
    spearPreviousSkillId: null,
    spearLastWasFinisher: false,
    // Starting axes persist through setup; combat entry starts their ordinary ten-second recall window.
    spinningAxes: Array.from(
      { length: boundedInteger(config.initialSpinningAxes, 0, 0, MAXIMUM_SPINNING_AXES) },
      () => ({
        skillId: ID.SPINNING_AXE,
        expiresAt: Infinity
      })
    ),
    outboundAxes: [],
    venomChargeBatches: {},
    activeThievesGuild: null,
    assassinsSignetPassiveDisabledUntil: 0,
    availableFlips: {},
    autoattackChains: {},
    activationClaims: {},
    revealedTrainingHitActivations: {},

    infiltratorsSignetPulseAt: null,
    strikeBrokeStealthAt: null,
    scepterChainExpiresAt: null
  };
}

// Core publishes only base-profession state; the family projector composes elite manifests separately.
const THIEF_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof ThiefCoreState)[] = Object.freeze([
  'initiative',
  'stealthStartedAt',
  'stealthUntil',
  'revealedUntil',
  'storedStolenSkillIds',
  'storedStolenSkillCount',
  'kneeling',
  'endurance',

  'leadAttackExpirations',
  'spearChainStage',
  'spearPreviousSkillId',
  'spearLastWasFinisher',
  'spinningAxes',
  'outboundAxes',
  'venomChargeBatches',
  'activeThievesGuild',
  'assassinsSignetPassiveDisabledUntil',
  'availableFlips',
  'autoattackChains'
]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const THIEF_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: THIEF_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});
