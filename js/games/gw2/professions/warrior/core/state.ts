import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { ActivationClaims } from '#gw2/platform/combat/procs/activation-claims.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface WarriorCoreState {
  adrenaline: ResourceClock;
  endurance: ResourceClock;

  autoattackChains: Record<string, SkillId>;
  availableFlips: SkillFlipWindows;

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
    availableFlips: {},

    activationClaims: {},
    signetOfRagePassive: createPeriodicTaskState(),
    empowerAllies: createPeriodicTaskState()
  };
}

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectWarriorCorePlanningState(input: Gw2PlanningStateInput) {
  const state = (input.profession as { core: ReturnType<typeof createWarriorCoreState> }).core;
  return structuredClone({
    [STATE.ADRENALINE]: state.adrenaline,
    [STATE.ENDURANCE]: state.endurance,
    [STATE.AUTOATTACK_CHAINS]: state.autoattackChains,
    [STATE.AVAILABLE_FLIPS]: state.availableFlips
  });
}
