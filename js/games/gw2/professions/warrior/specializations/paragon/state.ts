import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface ParagonState {
  motivation: ResourceClock;
  activeRefrainId: SkillId | null;

  callToActionActivated: boolean;
  /** Replacing a refrain cancels its queued occurrence without copying live combat state. */
  refrainGeneration: number;
  commandEchoes: Record<string, { skillId: SkillId; remaining: number; generation: number }>;
}

/** The policy initializes the detached pool; refrain and echo lifetimes remain owned by Paragon. */
function createParagonState(): ParagonState {
  return {
    motivation: createResourceClock(),
    activeRefrainId: null,

    callToActionActivated: false,
    refrainGeneration: 0,
    commandEchoes: {}
  };
}

export const paragonState = defineProfessionSpecializationState('Paragon', createParagonState);

/** Derive the public refrain label and detach selected fields without cloning private echo bookkeeping. */
export function projectParagonPlanningState(input: Gw2PlanningStateInput) {
  const state = paragonState.from(input);
  return {
    [STATE.MOTIVATION]: structuredClone(state.motivation),
    [STATE.ACTIVE_REFRAIN]:
      state.activeRefrainId == null ? '' : input.catalog.skillsById.get(state.activeRefrainId)?.name || ''
  };
}
