import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/profession-definition/state.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { selectedEngineerTraits } from '#gw2/professions/engineer/core/state.js';
import { mechArmsCommand } from '#gw2/professions/engineer/specializations/mechanist/traits/behavior.js';
import { mechCoreCommand } from '#gw2/professions/engineer/specializations/mechanist/traits/behavior.js';
import { mechFrameCommand } from '#gw2/professions/engineer/specializations/mechanist/traits/frames.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';

interface EngineerMechState {
  commandSkillIds: SkillId[];
  /** Owns the autonomous loop independently of commands. */
  attackLoopStarted: boolean;
  busyUntil: number;
}

export interface MechanistState {
  /** Trait startup admits one barrier loop; its task owns recurrence independently of the attack lane. */
  barrierEngine: PeriodicTaskState;
  mech: EngineerMechState;
}

// Only the Mechanist module publishes mech state; its presence needs no separate mutable flag.
export const MECHANIST_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  mech: {
    commandSkillIds: [],
    attackLoopStarted: false,
    busyUntil: 0
  }
} satisfies Partial<MechanistState>);

/** Resolves the three mech command skills supplied by the active mechanist traits. */
export function selectedMechCommands(traits: EngineerConfig | ReadonlySet<SkillId>): SkillId[] {
  return [mechArmsCommand(traits), mechFrameCommand(traits), mechCoreCommand(traits)];
}

/** The mech stays present throughout simulation; attack scheduling and live attributes belong to their runtime owners. */
export function createMechanistState(config: EngineerConfig = {}): MechanistState {
  const traits = selectedEngineerTraits(config);
  return {
    barrierEngine: createPeriodicTaskState(),
    mech: {
      commandSkillIds: selectedMechCommands(traits),
      attackLoopStarted: false,
      busyUntil: 0
    }
  };
}

export const mechanistState = defineProfessionSpecializationState('Mechanist', createMechanistState);
