import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { WarriorState } from '#gw2/professions/warrior/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export interface ParagonState {
  motivation: number;
  maximumMotivation: number;
  activeRefrainId: SkillId | null;
  nextRefrainAt: number;
  inspiringImplementsReadyAt: number;
  callToActionActivated: boolean;
}

/** Declares Paragon's public compatibility fields and inactive values. */
export const PARAGON_PUBLIC_END_STATE_KEYS = Object.freeze([
  'motivation',
  'maximumMotivation',
  'activeRefrain'
] as const satisfies readonly (keyof WarriorState)[]);

export const PARAGON_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<WarriorState>> = Object.freeze({
  motivation: 0,
  maximumMotivation: 10,
  activeRefrain: ''
});

export function createParagonState(): ParagonState {
  return {
    motivation: 0,
    maximumMotivation: 10,
    activeRefrainId: null,
    nextRefrainAt: 0,
    inspiringImplementsReadyAt: 0,
    callToActionActivated: false
  };
}

export const paragonState = defineProfessionSpecializationState('Paragon', createParagonState);
