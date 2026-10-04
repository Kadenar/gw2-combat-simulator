import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RechargeCheckpoint } from '#gw2/platform/execution/types.js';

interface MesmerContinuumSnapshot {
  splitId: SkillId;
  splitReady: number | undefined;
  openAt: number;
  recharge: RechargeCheckpoint;
  autoattackChains: Record<string, SkillId>;
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

/** Publishes this module's detached public observations at the planning boundary. */
export function projectChronomancerPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as MesmerChronomancerState;
  const at = canonicalTime(input.time);
  return {
    continuumActive: Boolean(state.continuum),
    continuumRemaining: state.continuum ? Math.max(0, Math.round((state.continuum.expiresAt - at) * 1000)) : 0
  };
}
