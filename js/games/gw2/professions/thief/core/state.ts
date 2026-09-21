import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { ChargePool } from '#gw2/platform/combat/resources/charges.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait, normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import type { ThiefConfig } from '#gw2/professions/thief/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export interface ThievesGuildState {
  /** Combat activation starts the parallel streams once per summon. */
  started: boolean;
  readonly ownerId: string;
  readonly variant: string;
  readonly expiresAt: number;
}

export interface ThiefCoreState {
  initiative: number;
  maximumInitiative: number;
  initiativeUpdatedAt: number;
  stealthStartedAt: number;
  stealthUntil: number;
  hiddenKillerUntil: number;
  revealedUntil: number;
  storedStolenSkillId: SkillId | null;
  storedStolenSkillIds: SkillId[];
  storedStolenSkillCount: number;
  kneeling: boolean;
  endurance: number;
  maximumEndurance: number;
  enduranceUpdatedAt: number;
  maximumHealth: number;
  leadAttacksStacks: number;
  leadAttackExpirations: number[];
  fluidStrikesUntil: number;
  quickPocketsReadyAt: number;
  spearChainStage: number;
  spearPreviousSkillId: SkillId | null;
  spearLastWasFinisher: boolean;
  distractingThrowBuffUntil: number;
  spinningAxeExpirations: number[];
  venomChargeBatches: ChargePool['grants'];
  venomAllyLastProcAt: Record<string, number>;
  venomGeneration: number;
  activeThievesGuild: ThievesGuildState | null;
  assassinsSignetActiveUntil: number;
  assassinsSignetPassiveDisabledUntil: number;
  availableFlips: SkillFlipWindows;
  autoattackChains: Record<string, SkillId>;
  traitProcProgress: Record<string, number>;
  traitProcReadyAt: Record<string, number>;
}

export const THIEF_BASE_HEALTH = 1645;

export function selectedThiefTraits(config: ThiefConfig = {}): Set<string | number> {
  // State initialization normalizes the canonical trait-ID selection once.
  return normalizeSelectedTraitIds(config.selectedTraitIds);
}

export function thiefBaseMaximumHealth(config: ThiefConfig = {}): number {
  const vitality = Number(config.stats?.vitality ?? config.attributes?.vitality ?? 1000);
  return THIEF_BASE_HEALTH + Math.max(0, vitality) * 10;
}

// Initialize bounded initiative and endurance plus complete stealth, venom,
// preparation, weapon-chain, stolen-skill, and trait bookkeeping.
export function createThiefCoreState(config: ThiefConfig = {}): ThiefCoreState {
  const traits = selectedThiefTraits(config);
  const maximumInitiative = hasTrait(traits, TRAIT.PREPAREDNESS) ? 15 : 12;
  return {
    initiative: boundedNumber(config.initialInitiative, 12, 0, maximumInitiative),
    maximumInitiative,
    initiativeUpdatedAt: 0,
    stealthStartedAt: 0,
    stealthUntil: 0,
    hiddenKillerUntil: 0,
    revealedUntil: 0,
    storedStolenSkillId: null,
    storedStolenSkillIds: [],
    storedStolenSkillCount: 0,
    kneeling: false,
    endurance: 100,
    maximumEndurance: 100,
    enduranceUpdatedAt: 0,
    maximumHealth: thiefBaseMaximumHealth(config),
    leadAttacksStacks: 0,
    leadAttackExpirations: [],
    fluidStrikesUntil: 0,
    quickPocketsReadyAt: 0,
    spearChainStage: 0,
    spearPreviousSkillId: null,
    spearLastWasFinisher: false,
    distractingThrowBuffUntil: 0,
    spinningAxeExpirations: [],
    venomChargeBatches: {},
    venomAllyLastProcAt: {},
    venomGeneration: 0,
    activeThievesGuild: null,
    assassinsSignetActiveUntil: 0,
    assassinsSignetPassiveDisabledUntil: 0,
    availableFlips: {},
    autoattackChains: {},
    traitProcProgress: {},
    traitProcReadyAt: {}
  };
}

// Core publishes only base-profession state; the family projector composes elite manifests separately.
export const THIEF_CORE_PUBLIC_END_STATE_KEYS: readonly (keyof ThiefCoreState)[] = Object.freeze([
  'initiative',
  'maximumInitiative',
  'stealthStartedAt',
  'stealthUntil',
  'revealedUntil',
  'storedStolenSkillId',
  'storedStolenSkillIds',
  'storedStolenSkillCount',
  'kneeling',
  'maximumHealth',
  'endurance',
  'maximumEndurance',
  'leadAttacksStacks',
  'fluidStrikesUntil',
  'quickPocketsReadyAt',
  'spearChainStage',
  'spearPreviousSkillId',
  'spearLastWasFinisher',
  'distractingThrowBuffUntil',
  'spinningAxeExpirations',
  'venomChargeBatches',
  'activeThievesGuild',
  'assassinsSignetActiveUntil',
  'assassinsSignetPassiveDisabledUntil',
  'availableFlips',
  'autoattackChains'
]);

// Core fields have no inactive fallbacks; their values come from the live state.
export const THIEF_CORE_PUBLIC_STATE_PROJECTION = Object.freeze({
  keys: THIEF_CORE_PUBLIC_END_STATE_KEYS,
  defaults: {}
});
