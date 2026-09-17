import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ThiefArtifactKind, ThiefConfig, ThiefStealthAttackChargeState } from '#gw2/professions/thief/types.js';

export interface ThiefArtifactSlot extends SchedulerRecord {
  readonly kind: ThiefArtifactKind;
  readonly skillId: SkillId;
}

export interface ThiefBackfireState extends SchedulerRecord {
  readonly activeUntil: number;
  readonly skillName: string;
}

export interface ThiefAntiquarySummon extends SchedulerRecord {
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
    forgedSurferMaximumBombHits: Math.max(
      1,
      Math.min(5, Number(config.deterministicChoices?.forgedSurferBombsHit || 5))
    ),
    canachCoinIndex: 0
  };
}

export const ANTIQUARY_PUBLIC_END_STATE_KEYS: readonly (keyof AntiquaryState)[] = Object.freeze([
  // Preserve Antiquary's three-row initiative layout when the palette reads projected simulation state.
  'initiativePipRows',
  'artifactSlots',
  'artifactUsesRemaining',
  // Expose spending progress so the insertion snapshot can show the next Pincher pilfer.
  'initiativeSpentSincePilfer',
  'scoundrelsLuck',
  'scoundrelsLuckReadyAt',
  'improvisationReadyAt',
  'backfireState',
  'activeAntiquarySummons',
  'nextSkrittScufflePilferAt',
  'antiquaryDamageUntil',
  'combatHighExpiresAt',
  'combatHighStacks',
  'mistburnCharges',
  'mistburnExpiresAt',
  'kryptisDamageUntil',
  'chakInitiativeRefundUntil',
  'holoUtilityCooldownReductionExpirations',
  'forgedSurferGeneration',
  'forgedSurferBombDropUntil',
  'forgedSurferMaximumBombHits',
  'canachCoinIndex'
]);

export const ANTIQUARY_INACTIVE_STATE_DEFAULTS: Readonly<Partial<AntiquaryState>> = Object.freeze({
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
});

export const antiquaryState = defineProfessionSpecializationState('Antiquary', createAntiquaryState);
