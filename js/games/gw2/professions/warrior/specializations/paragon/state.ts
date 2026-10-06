import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { projectPublicProfessionState, snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { WarriorState } from '#gw2/professions/warrior/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';

export interface ParagonState {
  motivation: ResourceClock;
  activeRefrainId: SkillId | null;

  callToActionActivated: boolean;
  /** Replacing a refrain cancels its queued occurrence without copying live combat state. */
  refrainGeneration: number;
  commandEchoes: Record<string, { skillId: SkillId; remaining: number; generation: number }>;
}

/** Declares Paragon's public fields and inactive values. */
export const PARAGON_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  motivation: createResourceClock(),
  activeRefrain: ''
} satisfies Partial<WarriorState>);

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

/** Publishes detached, current public values without mutating the live module state. */
export function projectParagonPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as ParagonState;
  const publicState = {
    ...state,
    activeRefrain: state.activeRefrainId == null ? '' : input.catalog.skillsById.get(state.activeRefrainId)?.name || ''
  };
  return projectPublicProfessionState(
    publicState,
    PARAGON_PUBLIC_STATE_PROJECTION.keys,
    PARAGON_PUBLIC_STATE_PROJECTION.defaults
  );
}
