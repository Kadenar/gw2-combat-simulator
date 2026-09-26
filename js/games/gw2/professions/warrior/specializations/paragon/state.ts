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
  inspiringImplementsReadyAt: number;
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

export function createParagonState(): ParagonState {
  return {
    motivation: 0,
    maximumMotivation: 10,
    activeRefrainId: null,
    inspiringImplementsReadyAt: 0,
    callToActionActivated: false,
    refrainGeneration: 0,
    commandEchoes: {}
  };
}

export const paragonState = defineProfessionSpecializationState('Paragon', createParagonState);
