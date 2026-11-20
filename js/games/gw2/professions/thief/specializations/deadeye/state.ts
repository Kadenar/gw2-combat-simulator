import { consumeCharge, createChargeGrant, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import {
  projectBonusStealthAttackCharges,
  type BonusStealthAttackCharges
} from '#gw2/professions/thief/core/mechanics/bonus-stealth-attacks.js';
import type { ActivationClaims } from '#kernel/execution/activation-claims.js';
import { createResourceClock, type ResourceClock } from '#kernel/resources/accrual.js';

export interface DeadeyeState {
  bonusStealthAttack: ChargeGrant;
  markedTargetId: string | null;
  markExpiresAt: number;
  markGeneration: number;
  malice: ResourceClock;
  deadeyeActivationClaims: ActivationClaims;
  maleficentSevenTriggered: boolean;
}

/** Starts an empty pool; the selected runtime policy supplies its trait and patch capacity. */
function createDeadeyeState(): DeadeyeState {
  return {
    markedTargetId: null,
    markExpiresAt: 0,
    // Bumped each time Deadeye's Mark is applied; the expiry task checks this to ignore stale scheduled expirations
    markGeneration: 0,
    malice: createResourceClock(),
    // Tracks which activationIds have already had their malice effect applied to prevent multi-hit double-counting
    deadeyeActivationClaims: {},
    // Prevents Maleficent Seven from firing more than once per mark application at full malice
    maleficentSevenTriggered: false,
    // Each qualifying dodge replaces Silent Scope's previous grant.
    bonusStealthAttack: createChargeGrant(0, 0)
  };
}

export const deadeyeState = defineProfessionSpecializationState('Deadeye', createDeadeyeState);

/** Silent Scope preserves its dodge grant when ordinary stealth supplies the attack. */
export const silentScopeCharges: BonusStealthAttackCharges = {
  grants: (profession) => [deadeyeState.from(profession).bonusStealthAttack],
  spend(profession, at, stealthed) {
    if (!stealthed) consumeCharge(deadeyeState.from(profession).bonusStealthAttack, at);
  }
};

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectDeadeyePlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = deadeyeState.from(input.profession);
  return {
    [STATE.MARKED_TARGET_ID]: state.markedTargetId,
    [STATE.MARK_GENERATION]: state.markGeneration,
    [STATE.MALICE]: state.malice,
    [STATE.BONUS_STEALTH_ATTACK_CHARGES]: projectBonusStealthAttackCharges(
      silentScopeCharges,
      input.profession,
      input.time
    ),
    [STATE.MALEFICENT_SEVEN_TRIGGERED]: state.maleficentSevenTriggered
  };
}
