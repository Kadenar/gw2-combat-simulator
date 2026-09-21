import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ThiefArtifactKind, ThiefConfig, ThiefStealthAttackChargeState } from '#gw2/professions/thief/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

export interface ThiefArtifactSlot {
  readonly kind: ThiefArtifactKind;
  readonly skillId: SkillId;
}

export interface ThiefBackfireState {
  readonly activeUntil: number;
  readonly skillName: string;
}

export interface ThiefAntiquarySummon {
  readonly skillId: SkillId;
  readonly name: string;
  readonly expiresAt: number;
}

export interface AntiquaryState extends ThiefStealthAttackChargeState {
  initiativePipRows: number;
  artifactSlots: ThiefArtifactSlot[];
  artifactUsesRemaining: number;
  scoundrelsLuck: number;
  scoundrelsLuckReadyAt: number;
  improvisationReadyAt: number;
  backfireState: Record<string, ThiefBackfireState>;
  initiativeSpentSincePilfer: number;
  activeAntiquarySummons: ThiefAntiquarySummon[];
  nextSkrittScufflePilferAt: number;
  antiquaryDamageUntil: number;
  combatHighExpiresAt: number;
  combatHighStacks: number;
  mistburnCharges: number;
  mistburnExpiresAt: number;
  mistburnGeneration: number;
  kryptisDamageUntil: number;
  chakInitiativeRefundUntil: number;
  holoUtilityCooldownReductionExpirations: number[];
  forgedSurferGeneration: number;
  forgedSurferBombDropUntil: number;
  forgedSurferMaximumBombHits: number;
  canachCoinIndex: number;
}

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
    // Snapshot reconciliation uses this identity to preserve charges already spent by the resolver.
    mistburnGeneration: 0,
    kryptisDamageUntil: 0,
    chakInitiativeRefundUntil: 0,
    holoUtilityCooldownReductionExpirations: [],
    forgedSurferGeneration: 0,
    forgedSurferBombDropUntil: 0,
    // clamped 1-5 at init so handleForgedSurfer never needs to bounds-check the assumption at runtime
    forgedSurferMaximumBombHits: boundedNumber(config.deterministicChoices?.forgedSurferBombsHit || 5, 5, 1, 5),
    canachCoinIndex: 0
  };
}

// Declares Antiquary public fields, including its own stealth-attack charges, without borrowing sibling metadata.
export const ANTIQUARY_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  // Inactive builds retain their two-row UI fallback; live Antiquary state supplies three rows.
  initiativePipRows: undefined,
  artifactSlots: [],
  artifactUsesRemaining: 0,
  initiativeSpentSincePilfer: 0,
  scoundrelsLuck: 0,
  scoundrelsLuckReadyAt: 0,
  improvisationReadyAt: 0,
  backfireState: {},
  activeAntiquarySummons: [],
  nextSkrittScufflePilferAt: 0,
  antiquaryDamageUntil: 0,
  combatHighExpiresAt: 0,
  combatHighStacks: 0,
  stealthAttackCharges: 0,
  stealthAttackExpiresAt: 0,
  mistburnCharges: 0,
  mistburnExpiresAt: 0,
  kryptisDamageUntil: 0,
  chakInitiativeRefundUntil: 0,
  holoUtilityCooldownReductionExpirations: [],
  forgedSurferGeneration: 0,
  forgedSurferBombDropUntil: 0,
  forgedSurferMaximumBombHits: 5,
  canachCoinIndex: 0
} satisfies Partial<AntiquaryState>);

export const antiquaryState = defineProfessionSpecializationState('Antiquary', createAntiquaryState);
