import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface WarriorCoreState {
  adrenaline: ResourceClock;
  endurance: ResourceClock;

  autoattackChains: Record<string, SkillId>;

  activationClaims: ActivationClaims;
  /** Readiness waits for the next actual signet pulse instead of crediting future adrenaline. */
  signetOfRagePassive: PeriodicTaskState;
  empowerAllies: PeriodicTaskState;
}

/** Creates only the state shared by every Warrior build; selected resource policies supply pool values and caps. */
export function createWarriorCoreState(): WarriorCoreState {
  return {
    adrenaline: createResourceClock(),
    endurance: createResourceClock(ENDURANCE.maximum),

    autoattackChains: {},

    activationClaims: {},
    signetOfRagePassive: createPeriodicTaskState(),
    empowerAllies: createPeriodicTaskState()
  };
}

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectWarriorCorePlanningState(input: Gw2PlanningStateInput) {
  const state = (input.profession as { core: ReturnType<typeof createWarriorCoreState> }).core;
  return {
    [STATE.ADRENALINE]: state.adrenaline,
    [STATE.ENDURANCE]: state.endurance,
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains
  };
}
