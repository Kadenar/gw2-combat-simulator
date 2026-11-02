import {
  activeChargeCount,
  activeChargeGrants,
  grantCharges,
  type ChargeGrant
} from '#gw2/platform/combat/resources/charges.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import type { ThiefArtifactKind } from '#gw2/professions/thief/types.js';

export interface ThiefArtifactSlot {
  readonly kind: ThiefArtifactKind;
  readonly skillId: SkillId;
}

export interface AntiquaryState {
  bonusStealthAttack: ChargeGrant;
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

export const antiquaryState = defineProfessionSpecializationState('Antiquary', createAntiquaryState);

/** Derive active public grants and stacks without consuming live entitlements; the observer detaches the result. */
export function projectAntiquaryPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = antiquaryState.from(input.profession);
  return {
    [STATE.BONUS_STEALTH_ATTACK]: state.bonusStealthAttack,
    [STATE.ARTIFACT_SLOTS]: state.artifactSlots,
    [STATE.ARTIFACT_USES_REMAINING]: state.artifactUsesRemaining,
    [STATE.SCOUNDRELS_LUCK]: state.scoundrelsLuck,
    [STATE.INITIATIVE_SPENT_SINCE_PILFER]: state.initiativeSpentSincePilfer,
    [STATE.NEXT_SKRITT_SCUFFLE_PILFER_AT]: state.nextSkrittScufflePilferAt,
    [STATE.ANTIQUARY_DAMAGE_UNTIL]: state.antiquaryDamageUntil,
    [STATE.COMBAT_HIGH_EXPIRATIONS]: purgeExpiredStacks(state.combatHighExpirations, input.time),
    [STATE.MISTBURN]: { ...state.mistburn, charges: activeChargeCount(state.mistburn, input.time) },
    [STATE.KRYPTIS_DAMAGE_UNTIL]: state.kryptisDamageUntil,
    [STATE.CHAK_INITIATIVE_REFUNDS]: activeChargeGrants(state.chakInitiativeRefunds, input.time),
    [STATE.HOLO_UTILITY_COOLDOWN_REDUCTION_EXPIRATIONS]: purgeExpiredStacks(
      state.holoUtilityCooldownReductionExpirations,
      input.time
    ),
    [STATE.FORGED_SURFER_BOMB_DROP_UNTIL]: state.forgedSurferBombDropUntil
  };
}
