import { GW2_ACTION_TICK_MS } from '#gw2/platform/combat/action-tick.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { timeKey } from '#kernel/core/clock.js';
import { boundedNumber } from '#kernel/core/numeric.js';

const FLOW_TICK = 'warrior.flow-tick';

/** Flow uses the absolute action grid; a grant at a tick cannot receive regeneration for that same tick. */
function scheduleFlowTick(runtime: WarriorRuntime): void {
  const tick = Math.floor(timeKey(runtime.time) / (GW2_ACTION_TICK_MS * 1000)) + 1;
  runtime.schedule(FLOW_TICK, (tick * GW2_ACTION_TICK_MS) / 1000, null, undefined, -250);
}

/** Credit the interval ending now before closing its windows; no future rate or event-history projection is needed. */
function flowTick(runtime: WarriorRuntime): void {
  const state = bladeswornState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.GUN_X_SWORD);
  const active = (start: number, end: number) => start < runtime.time && runtime.time <= end;
  const stabilizers = state.flowStabilizerWindows.filter((window) => active(window.startedAt, window.expiresAt));
  const rate =
    (runtime.engagement.active ? balanceProfileNumber(profile, 'energyRegenerationPerSecond') : 0) +
    // Skill and trait Positive Flow share one per-stack regeneration rate.
    stabilizers.reduce((total, window) => total + window.stacks, 0) *
      balanceProfileNumber(profile, 'attributePerStack') +
    (active(state.traitPositiveFlowStartedAt, state.traitPositiveFlowUntil)
      ? state.traitPositiveFlowStacks * balanceProfileNumber(profile, 'attributePerStack')
      : 0);
  runtime.resourceController.grant('flow', rate * (GW2_ACTION_TICK_MS / 1000));
  state.flowStabilizerWindows = state.flowStabilizerWindows.filter((window) => window.expiresAt > runtime.time);

  if (state.traitPositiveFlowUntil <= runtime.time) {
    state.traitPositiveFlowStartedAt = 0;
    state.traitPositiveFlowUntil = 0;
    state.traitPositiveFlowStacks = 0;
  }

  scheduleFlowTick(runtime);
}

const flowTasks: RuntimeProfession<WarriorRuntimeState, WarriorSkill>['tasks'] = { [FLOW_TICK]: flowTick };

/** The shared pool owns Flow arithmetic; only the absolute-grid task supplies regeneration. */
const bladeswornFlowPolicy: ResourcePolicy<WarriorRuntime> = {
  kind: 'continuous',
  state: (runtime) => bladeswornState.from(runtime).flow,
  maximum: (runtime) => balanceNumberFromContext(runtime, TRAIT.GUN_X_SWORD, 'maximumStacks'),
  initial: (runtime, maximum) => boundedNumber(runtime.config.initialResource ?? 0, 0, 0, maximum),
  recovery: () => 0
};

/** Flow owns its pool, its absolute-grid tick, and starting that tick at initialization. */
export const bladeswornFlowLifecycle = {
  resources: { flow: bladeswornFlowPolicy },
  initialize: scheduleFlowTick,
  tasks: flowTasks
} satisfies RuntimeHooks<WarriorRuntimeState, WarriorSkill>;
