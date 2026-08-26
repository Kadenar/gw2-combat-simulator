import { THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type { SkillId } from '../../../platform/engine/types.js';
import type { ThiefConfig, ThiefCoreState } from '../types.js';

export const THIEF_BASE_HEALTH = 1645;

export function selectedThiefTraits(config: ThiefConfig = {}): Set<string | number> {
  // State initialization normalizes the canonical trait-ID selection once.
  return new Set(
    (config.selectedTraitIds || []).map((value) => (Number.isFinite(Number(value)) ? Number(value) : value))
  );
}

export function hasThiefTrait(configOrTraits: ThiefConfig | ReadonlySet<string | number>, traitId: SkillId): boolean {
  const traits =
    typeof (configOrTraits as ReadonlySet<string | number>).has === 'function'
      ? (configOrTraits as ReadonlySet<string | number>)
      : selectedThiefTraits(configOrTraits as ThiefConfig);
  return traits.has(traitId) || traits.has(String(traitId));
}

export function thiefBaseMaximumHealth(config: ThiefConfig = {}): number {
  const vitality = Number(config.stats?.vitality ?? config.attributes?.vitality ?? 1000);
  return THIEF_BASE_HEALTH + Math.max(0, vitality) * 10;
}

// Initialize bounded initiative and endurance plus complete stealth, venom,
// weapon-chain, stolen-skill, and trait bookkeeping.
export function createThiefCoreState(config: ThiefConfig = {}): ThiefCoreState {
  const traits = selectedThiefTraits(config);
  const maximumInitiative = hasThiefTrait(traits, TRAIT.PREPAREDNESS) ? 15 : 12;
  return {
    initiative: Math.min(maximumInitiative, Math.max(0, Number(config.initialInitiative ?? 12))),
    maximumInitiative,
    initiativeUpdatedAt: 0,
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
    thousandNeedlesPrepared: false,
    thousandNeedlesArmedAt: 0,
    thousandNeedlesGeneration: 0,
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
  'thousandNeedlesPrepared',
  'thousandNeedlesArmedAt',
  'thousandNeedlesGeneration',
  'activeThievesGuild',
  'assassinsSignetActiveUntil',
  'assassinsSignetPassiveDisabledUntil',
  'availableFlips',
  'autoattackChains'
]);
