import {
  activeChargeGrants,
  expireCharges,
  grantCharges,
  type ChargeGrant
} from '#gw2/platform/combat/resources/charges.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  defineProfessionSpecializationState,
  definePublicStateDefaults,
  projectPublicProfessionState,
  snapshotProfessionState
} from '#gw2/platform/profession-definition/state.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { ThiefArtifactKind } from '#gw2/professions/thief/types.js';

export interface ThiefArtifactSlot {
  readonly kind: ThiefArtifactKind;
  readonly skillId: SkillId;
}

export interface AntiquaryState {
  bonusStealthAttack: ChargeGrant;
  initiativePipRows: number;
  artifactSlots: ThiefArtifactSlot[];
  artifactUsesRemaining: number;
  scoundrelsLuck: number;

  backfireState: Record<string, true>;
  initiativeSpentSincePilfer: number;
  nextSkrittScufflePilferAt: number;
  antiquaryDamageUntil: number;
  combatHighExpirations: number[];
  mistburn: ChargeGrant;
  kryptisDamageUntil: number;
  chakInitiativeRefunds: ChargeGrant[];
  holoUtilityCooldownReductionExpirations: number[];
  forgedSurferBombDropUntil: number;
  canachCoinIndex: number;
}

export function createAntiquaryState(): AntiquaryState {
  return {
    initiativePipRows: 3,
    artifactSlots: [],
    artifactUsesRemaining: 0,
    scoundrelsLuck: 0,

    backfireState: {},
    initiativeSpentSincePilfer: 0,
    nextSkrittScufflePilferAt: 0,
    antiquaryDamageUntil: 0,
    combatHighExpirations: [],
    bonusStealthAttack: grantCharges(0, 0),
    mistburn: grantCharges(0, 0),
    kryptisDamageUntil: 0,
    chakInitiativeRefunds: [],
    holoUtilityCooldownReductionExpirations: [],
    forgedSurferBombDropUntil: 0,
    canachCoinIndex: 0
  };
}

// Publish Antiquary's visible resources and windows; artifact outcomes and sequence counters remain runtime-only.
export const ANTIQUARY_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  // Inactive builds retain their two-row UI fallback; live Antiquary state supplies three rows.
  initiativePipRows: undefined,
  artifactSlots: [],
  artifactUsesRemaining: 0,
  initiativeSpentSincePilfer: 0,
  scoundrelsLuck: 0,

  nextSkrittScufflePilferAt: 0,
  antiquaryDamageUntil: 0,
  combatHighExpirations: [],
  bonusStealthAttack: grantCharges(0, 0),
  mistburn: grantCharges(0, 0),
  kryptisDamageUntil: 0,
  chakInitiativeRefunds: [],
  holoUtilityCooldownReductionExpirations: [],
  forgedSurferBombDropUntil: 0
} satisfies Partial<AntiquaryState>);

export const antiquaryState = defineProfessionSpecializationState('Antiquary', createAntiquaryState);

/** Publishes detached, current public values without mutating the live module state. */
export function projectAntiquaryPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as AntiquaryState;
  expireCharges(state.mistburn, input.time);
  state.chakInitiativeRefunds = activeChargeGrants(state.chakInitiativeRefunds, input.time);
  state.combatHighExpirations = purgeExpiredStacks(state.combatHighExpirations, input.time);
  state.holoUtilityCooldownReductionExpirations = purgeExpiredStacks(
    state.holoUtilityCooldownReductionExpirations,
    input.time
  );
  return projectPublicProfessionState(
    state,
    ANTIQUARY_PUBLIC_STATE_PROJECTION.keys,
    ANTIQUARY_PUBLIC_STATE_PROJECTION.defaults
  );
}
