import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { ThiefConfig, ThiefCoreState } from '#gw2/professions/thief/types.js';

export const THIEF_BASE_HEALTH = 1645;

/** Detaches the composed runtime state before it crosses the scheduler event boundary. */
export function snapshotThiefState<TState extends object = Record<string, unknown>>(state: unknown): TState {
  return snapshotProfessionState<TState>(state);
}

export function selectedThiefTraits(config: ThiefConfig = {}): Set<string | number> {
  // State initialization normalizes the canonical trait-ID selection once.
  return new Set(
    (config.selectedTraitIds || []).map((value) => (Number.isFinite(Number(value)) ? Number(value) : value))
  );
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
    initiative: Math.min(maximumInitiative, Math.max(0, Number(config.initialInitiative ?? 12))),
    maximumInitiative,
    initiativeUpdatedAt: 0,
    stealthStartedAt: 0,
    stealthUntil: 0,
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
    leadAttacksUntil: 0,
    leadAttackExpirations: [],
    fluidStrikesUntil: 0,
    quickPocketsReadyAt: 0,
    spearChainStage: 0,
    spearPreviousSkillId: null,
    spearLastWasFinisher: false,
    distractingThrowBuffUntil: 0,
    spiderVenomCharges: 0,
    spiderVenomExpiresAt: 0,
    spiderVenomGeneration: 0,
    skaleVenomCharges: 0,
    skaleVenomExpiresAt: 0,
    skaleVenomGeneration: 0,
    devourerVenomCharges: 0,
    devourerVenomExpiresAt: 0,
    devourerVenomGeneration: 0,
    thousandNeedlesPrepared: false,
    thousandNeedlesArmedAt: 0,
    pitfallPrepared: false,
    pitfallArmedAt: 0,
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
  'leadAttacksUntil',
  'fluidStrikesUntil',
  'quickPocketsReadyAt',
  'spearChainStage',
  'spearPreviousSkillId',
  'spearLastWasFinisher',
  'distractingThrowBuffUntil',
  'spiderVenomCharges',
  'spiderVenomExpiresAt',
  'spiderVenomGeneration',
  'skaleVenomCharges',
  'skaleVenomExpiresAt',
  'skaleVenomGeneration',
  'devourerVenomCharges',
  'devourerVenomExpiresAt',
  'devourerVenomGeneration',
  'thousandNeedlesPrepared',
  'thousandNeedlesArmedAt',
  'pitfallPrepared',
  'pitfallArmedAt',
  'activeThievesGuild',
  'assassinsSignetActiveUntil',
  'assassinsSignetPassiveDisabledUntil',
  'availableFlips',
  'autoattackChains'
]);
