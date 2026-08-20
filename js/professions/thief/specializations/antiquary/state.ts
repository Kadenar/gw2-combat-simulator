import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';
import type { AntiquaryState, ThiefConfig } from '../../types.js';

export function createAntiquaryState(config: ThiefConfig = {}): AntiquaryState {
  return {
    initiativePipRows: 3,
    artifactSlots: [],
    artifactUsesRemaining: 0,
    scoundrelsLuck: 0,
    scoundrelsLuckReadyAt: 0,
    improvisationReadyAt: 0,
    backfireState: {},
    initiativeSpentSincePilfer: 0,
    activeAntiquarySummons: [],
    nextSkrittScufflePilferAt: 0,
    antiquaryDamageUntil: 0,
    combatHighExpiresAt: 0,
    combatHighStacks: 0,
    stealthAttackCharges: 0,
    stealthAttackExpiresAt: 0,
    mistburnCharges: 0,
    mistburnExpiresAt: 0,
    mistburnGeneration: 0,
    kryptisDamageUntil: 0,
    chakInitiativeRefundUntil: 0,
    holoUtilityCooldownReduction: 0,
    holoUtilityCooldownReductionExpiresAt: 0,
    holoUtilityCooldownReductionExpirations: [],
    forgedSurferGeneration: 0,
    // clamped 1–5 at init so handleForgedSurfer never needs to bounds-check the assumption at runtime
    forgedSurferMaximumBombHits: Math.max(
      1,
      Math.min(5, Number(config.deterministicChoices?.forgedSurferBombsHit || 5))
    ),
    canachCoinIndex: 0
  };
}

export const ANTIQUARY_PUBLIC_END_STATE_KEYS: readonly (keyof AntiquaryState)[] = Object.freeze([
  'artifactSlots',
  'artifactUsesRemaining',
  'scoundrelsLuck',
  'scoundrelsLuckReadyAt',
  'improvisationReadyAt',
  'backfireState',
  'activeAntiquarySummons',
  'nextSkrittScufflePilferAt',
  'antiquaryDamageUntil',
  'combatHighExpiresAt',
  'combatHighStacks',
  'artifactStealthAttacksRemaining',
  'artifactStealthAttackExpiresAt',
  'mistburnCharges',
  'mistburnExpiresAt',
  'mistburnGeneration',
  'kryptisDamageUntil',
  'chakInitiativeRefundUntil',
  'holoUtilityCooldownReduction',
  'holoUtilityCooldownReductionExpiresAt',
  'holoUtilityCooldownReductionExpirations',
  'forgedSurferGeneration',
  'forgedSurferMaximumBombHits',
  'canachCoinIndex'
]);

export const ANTIQUARY_INACTIVE_STATE_DEFAULTS: Readonly<Partial<AntiquaryState>> = Object.freeze({
  artifactSlots: [],
  artifactUsesRemaining: 0,
  scoundrelsLuck: 0,
  scoundrelsLuckReadyAt: 0,
  improvisationReadyAt: 0,
  backfireState: {},
  activeAntiquarySummons: [],
  nextSkrittScufflePilferAt: 0,
  antiquaryDamageUntil: 0,
  combatHighExpiresAt: 0,
  combatHighStacks: 0,
  artifactStealthAttacksRemaining: 0,
  artifactStealthAttackExpiresAt: 0,
  mistburnCharges: 0,
  mistburnExpiresAt: 0,
  mistburnGeneration: 0,
  kryptisDamageUntil: 0,
  chakInitiativeRefundUntil: 0,
  holoUtilityCooldownReduction: 0,
  holoUtilityCooldownReductionExpiresAt: 0,
  holoUtilityCooldownReductionExpirations: [],
  forgedSurferGeneration: 0,
  forgedSurferMaximumBombHits: 5,
  canachCoinIndex: 0
});

export const antiquaryState = defineProfessionSpecializationState('Antiquary', createAntiquaryState);
