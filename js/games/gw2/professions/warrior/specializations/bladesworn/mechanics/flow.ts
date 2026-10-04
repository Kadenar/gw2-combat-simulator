import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { GW2_ACTION_TICK_MS } from '#gw2/platform/skills/timing.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { timeKey } from '#kernel/core/clock.js';
type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
const FLOW_TICK = 'warrior.flow-tick';
/** Flow uses the absolute action grid; a grant at a tick cannot receive regeneration for that same tick. */
export function scheduleFlowTick(runtime: Runtime): void {
  const tick = Math.floor(timeKey(runtime.time) / (GW2_ACTION_TICK_MS * 1000)) + 1;
  runtime.schedule(FLOW_TICK, (tick * GW2_ACTION_TICK_MS) / 1000, null, undefined, -250);
}

/** Credit the interval ending now before closing its windows; no future rate or event-history projection is needed. */
function flowTick(runtime: Runtime): void {
  const state = bladeswornState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  const active = (start: number, end: number) => start < runtime.time && runtime.time <= end;
  const stabilizers = state.flowStabilizerWindows.filter((window) => active(window.startedAt, window.expiresAt));
  const rate =
    (runtime.combatActive ? balanceProfileNumber(profile, 'energyRegenerationPerSecond') : 0) +
    stabilizers.length * balanceProfileNumber(profile, 'resourceGain') +
    (active(state.traitPositiveFlowStartedAt, state.traitPositiveFlowUntil)
      ? state.traitPositiveFlowStacks * balanceProfileNumber(profile, 'attributePerStack')
      : 0);
  grantWarriorAdrenaline(runtime, rate * (GW2_ACTION_TICK_MS / 1000));
  state.flowStabilizerWindows = state.flowStabilizerWindows.filter((window) => window.expiresAt > runtime.time);
  if (state.traitPositiveFlowUntil <= runtime.time) {
    state.traitPositiveFlowStartedAt = 0;
    state.traitPositiveFlowUntil = 0;
    state.traitPositiveFlowStacks = 0;
  }

  scheduleFlowTick(runtime);
}

export const flowTasks: RuntimeProfession<WarriorRuntimeState, WarriorSkill>['tasks'] = { [FLOW_TICK]: flowTick };
