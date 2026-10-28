import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { grantCharges, type ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

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
    // Silent Scope owns its replacement grant; Core consumes it only for the active specialization.
    bonusStealthAttack: grantCharges(0, 0)
  };
}

export const deadeyeState = defineProfessionSpecializationState('Deadeye', createDeadeyeState);

/** Accepted marked malice remains available until the skill's commitment actions finish. */
interface DeadeyeCastFacts {
  readonly markedMalice: number;
}

export const deadeyeCastFacts = new WeakMap<RuntimeCast<ThiefSkill>, DeadeyeCastFacts>();

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectDeadeyePlanningState(input: Gw2PlanningStateInput) {
  const state = deadeyeState.from(input);
  return structuredClone({
    [STATE.MARKED_TARGET_ID]: state.markedTargetId,
    [STATE.MARK_EXPIRES_AT]: state.markExpiresAt,
    [STATE.MARK_GENERATION]: state.markGeneration,
    [STATE.MALICE]: state.malice,
    [STATE.BONUS_STEALTH_ATTACK]: state.bonusStealthAttack,
    [STATE.MALEFICENT_SEVEN_TRIGGERED]: state.maleficentSevenTriggered
  });
}
