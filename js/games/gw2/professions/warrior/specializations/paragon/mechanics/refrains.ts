import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';

import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
export const REFRAIN = 'warrior.paragon-refrain';
/** Replacing even the same chant invalidates the old pulse before arming a new cadence. */
export function startRefrain(runtime: Runtime): void {
  const state = paragonState.from(runtime);
  runtime.cancelOwner({ id: REFRAIN, generation: state.refrainGeneration });
  state.refrainGeneration++;
  const interval = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'pulseInterval');
  if (interval > 0)
    runtime.schedule(
      REFRAIN,
      canonicalTime(runtime.time + interval),
      null,
      { id: REFRAIN, generation: state.refrainGeneration },
      -200
    );
}
