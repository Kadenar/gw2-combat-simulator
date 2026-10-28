import type { RechargeCheckpoint } from '#gw2/platform/execution/cooldown-contracts.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { canonicalTime } from '#kernel/core/clock.js';

interface MesmerContinuumSnapshot {
  splitId: SkillId;
  splitReady: number | undefined;
  openAt: number;
  recharge: RechargeCheckpoint;
  expiresAt: number;
}

export interface MesmerChronomancerState {
  continuum: MesmerContinuumSnapshot | null;
  timeBombUntil: number;
}

/** Starts each Chronomancer with no active continuum snapshot or time bomb. */
function createChronomancerState(): MesmerChronomancerState {
  return {
    continuum: null,
    timeBombUntil: 0
  };
}

export const chronomancerState = defineProfessionSpecializationState('Chronomancer', createChronomancerState);

/** Derive scalar observations directly; the private continuum checkpoint never needs copying. */
export function projectChronomancerPlanningState(input: Gw2PlanningStateInput) {
  const state = chronomancerState.from(input);
  const at = canonicalTime(input.time);
  return {
    [STATE.CONTINUUM_ACTIVE]: Boolean(state.continuum),
    [STATE.CONTINUUM_REMAINING]: state.continuum ? Math.max(0, Math.round((state.continuum.expiresAt - at) * 1000)) : 0
  };
}
