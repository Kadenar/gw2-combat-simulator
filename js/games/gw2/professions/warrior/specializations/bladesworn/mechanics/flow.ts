import { buffDeadlineActive, buffWindowActive } from '#gw2/platform/combat/buff-expiry.js';
import { GW2_TICK_MS } from '#gw2/platform/combat/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { balanceNumber, balanceProfileNumber, requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { timeKey } from '#kernel/core/clock.js';
import { boundedNumber } from '#kernel/core/numeric.js';

const FLOW_TICK = 'warrior.flow-tick';

interface PositiveFlowWindow {
  startedAt: number;
  expiresAt: number | null;
  stacks: number;
}

export interface PositiveFlowGrant extends PositiveFlowWindow {
  source: 'combat' | 'stabilizer' | 'gunsaber';
}

/** Stabilizer casts stack independently. Gunsaber entry refreshes the existing trait grant. */
export function grantPositiveFlow(
  runtime: WarriorRuntime,
  source: 'stabilizer' | 'gunsaber',
  stacks: number,
  duration: number
): void {
  const grants = bladeswornState.from(runtime.profession).positiveFlow;
  const at = runtime.time;
  const expiresAt = gw2EffectExpiresAt(at, duration);
  const index = source === 'gunsaber' ? grants.findIndex((grant) => grant.source === source) : -1;
  const previous = index >= 0 ? grants.splice(index, 1)[0] : undefined;

  if (expiresAt <= at) return;

  const startedAt =
    previous && buffWindowActive(at, previous.startedAt, previous.expiresAt ?? Infinity) ? previous.startedAt : at;
  grants.push({ source, startedAt, expiresAt, stacks });
}

/** The row counts grants at both endpoints and shows the first temporary stack due to expire. */
export function positiveFlowAt(windows: readonly PositiveFlowWindow[], at: number) {
  let stacks = 0;
  let nextExpiry = Infinity;
  for (const window of windows) {
    if (window.stacks <= 0 || !buffWindowActive(at, window.startedAt, window.expiresAt ?? Infinity)) continue;

    stacks += window.stacks;
    nextExpiry = Math.min(nextExpiry, window.expiresAt ?? Infinity);
  }

  return { stacks, remaining: nextExpiry === Infinity ? null : nextExpiry - at };
}

/** Flow uses the absolute action grid; a grant at a tick cannot receive regeneration for that same tick. */
function scheduleFlowTick(runtime: WarriorRuntime): void {
  const tick = Math.floor(timeKey(runtime.time) / (GW2_TICK_MS * 1000)) + 1;
  runtime.schedule(FLOW_TICK, (tick * GW2_TICK_MS) / 1000, null, undefined, -250);
}

/** Credit the interval ending now before closing its windows; no future rate or event-history projection is needed. */
function flowTick(runtime: WarriorRuntime): void {
  const state = bladeswornState.from(runtime.profession);
  const profile = requireBalanceProfile(runtime.helpers, TRAIT.GUN_X_SWORD);
  // Keep the final tick at expiry. A grant starting on this tick only earns Flow on the next one.
  state.positiveFlow = state.positiveFlow.filter(
    (grant) => grant.expiresAt == null || buffDeadlineActive(grant.expiresAt, runtime.time)
  );
  const temporaryStacks = state.positiveFlow.reduce(
    (total, grant) => total + (grant.source !== 'combat' && grant.startedAt < runtime.time ? grant.stacks : 0),
    0
  );
  const rate =
    (runtime.engagement.active ? balanceProfileNumber(profile, 'energyRegenerationPerSecond') : 0) +
    temporaryStacks * balanceProfileNumber(profile, 'attributePerStack');
  runtime.resourceController.grant('flow', rate * (GW2_TICK_MS / 1000));

  scheduleFlowTick(runtime);
}

const flowTasks: RuntimeHooks<WarriorRuntimeState, WarriorSkill>['tasks'] = { [FLOW_TICK]: flowTick };

/** The shared pool owns Flow arithmetic; only the absolute-grid task supplies regeneration. */
const bladeswornFlowPolicy: ResourcePolicy<WarriorRuntime> = {
  kind: 'continuous',
  state: (runtime) => bladeswornState.from(runtime.profession).flow,
  maximum: (runtime) => balanceNumber(runtime.helpers, TRAIT.GUN_X_SWORD, 'maximumStacks'),
  initial: (runtime, maximum) => boundedNumber(runtime.config.initialResource ?? 0, 0, 0, maximum),
  recovery: () => 0
};

/** Flow owns its pool, its absolute-grid tick, and starting that tick at initialization. */
export const bladeswornFlowLifecycle = {
  resources: { flow: bladeswornFlowPolicy },
  initialize: scheduleFlowTick,
  onCombatStart(runtime) {
    bladeswornState.from(runtime.profession).positiveFlow.push({
      source: 'combat',
      startedAt: runtime.time,
      expiresAt: null,
      stacks: 1
    });
  },
  tasks: flowTasks
} satisfies RuntimeHooks<WarriorRuntimeState, WarriorSkill>;
