import {
  activeChargeGrants,
  expireCharges,
  grantCharges,
  type ChargeGrant
} from '#gw2/platform/combat/resources/charges.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { cloneStateFields, defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
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

/** Detach public grants and stacks before expiring them so observations never consume live entitlements. */
export function projectAntiquaryPlanningState(input: Gw2PlanningStateInput) {
  const state = cloneStateFields(antiquaryState.from(input), [
    'artifactSlots',
    'artifactUsesRemaining',
    'initiativeSpentSincePilfer',
    'scoundrelsLuck',
    'nextSkrittScufflePilferAt',
    'antiquaryDamageUntil',
    'combatHighExpirations',
    'bonusStealthAttack',
    'mistburn',
    'kryptisDamageUntil',
    'chakInitiativeRefunds',
    'holoUtilityCooldownReductionExpirations',
    'forgedSurferBombDropUntil'
  ]);
  expireCharges(state.mistburn, input.time);
  state.chakInitiativeRefunds = activeChargeGrants(state.chakInitiativeRefunds, input.time);
  state.combatHighExpirations = purgeExpiredStacks(state.combatHighExpirations, input.time);
  state.holoUtilityCooldownReductionExpirations = purgeExpiredStacks(
    state.holoUtilityCooldownReductionExpirations,
    input.time
  );
  return {
    [STATE.BONUS_STEALTH_ATTACK]: state.bonusStealthAttack,
    [STATE.ARTIFACT_SLOTS]: state.artifactSlots,
    [STATE.ARTIFACT_USES_REMAINING]: state.artifactUsesRemaining,
    [STATE.SCOUNDRELS_LUCK]: state.scoundrelsLuck,
    [STATE.INITIATIVE_SPENT_SINCE_PILFER]: state.initiativeSpentSincePilfer,
    [STATE.NEXT_SKRITT_SCUFFLE_PILFER_AT]: state.nextSkrittScufflePilferAt,
    [STATE.ANTIQUARY_DAMAGE_UNTIL]: state.antiquaryDamageUntil,
    [STATE.COMBAT_HIGH_EXPIRATIONS]: state.combatHighExpirations,
    [STATE.MISTBURN]: state.mistburn,
    [STATE.KRYPTIS_DAMAGE_UNTIL]: state.kryptisDamageUntil,
    [STATE.CHAK_INITIATIVE_REFUNDS]: state.chakInitiativeRefunds,
    [STATE.HOLO_UTILITY_COOLDOWN_REDUCTION_EXPIRATIONS]: state.holoUtilityCooldownReductionExpirations,
    [STATE.FORGED_SURFER_BOMB_DROP_UNTIL]: state.forgedSurferBombDropUntil
  };
}
