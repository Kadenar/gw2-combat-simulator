import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import { projectPublicProfessionState, snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { WarriorState } from '#gw2/professions/warrior/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export interface ParagonState {
  motivation: number;
  maximumMotivation: number;
  activeRefrainId: SkillId | null;

  callToActionActivated: boolean;
  /** Replacing a refrain cancels its queued occurrence without copying live combat state. */
  refrainGeneration: number;
  commandEchoes: Record<string, { skillId: SkillId; remaining: number; generation: number }>;
}

/** Declares Paragon's public fields and inactive values. */
export const PARAGON_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  motivation: 0,
  maximumMotivation: 10,
  activeRefrain: ''
} satisfies Partial<WarriorState>);

function createParagonState(): ParagonState {
  return {
    motivation: 0,
    maximumMotivation: 10,
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
