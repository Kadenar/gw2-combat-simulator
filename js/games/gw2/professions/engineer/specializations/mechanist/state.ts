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

interface EngineerMechState {
  enabled: boolean;
  active: boolean;
  commandSkillIds: SkillId[];
  busyUntil: number;
}

export interface MechanistState {
  mech: EngineerMechState;
}

// Mechanist owns its public mech projection and the disabled inactive representation.
export const MECHANIST_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  mech: {
    enabled: false,
    active: false,
    commandSkillIds: [],
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
    mech: {
      enabled: true,
      active: true,
      commandSkillIds: selectedMechCommands(traits),
      busyUntil: 0
    }
  };
}

export const mechanistState = defineProfessionSpecializationState('Mechanist', createMechanistState);
