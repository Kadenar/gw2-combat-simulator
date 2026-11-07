/** Condition observations cannot change lifetimes or reach private payout state. */
import type { Gw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ConditionWorkEvent, Gw2ResolverStageDetails } from '#gw2/platform/resolver/types.js';

export function checkConditionOwnership(
  conditions: Gw2ConditionResolution,
  runtime: Gw2ResolverRuntime,
  event: Gw2ConditionWorkEvent,
  applied: Gw2ResolverStageDetails['condition.applied'],
  settled: Gw2ResolverStageDetails['condition-tick.resolved']
) {
  conditions.retireCompanionConditions('companion', 1);
  const applications = conditions.applyCondition(runtime, event);
  const state = runtime.conditionState.get('Bleeding')!;
  // @ts-expect-error Runtime observations cannot replace the condition store.
  runtime.conditionState = new Map();
  // @ts-expect-error Only condition resolution inserts or deletes condition state.
  runtime.conditionState.clear();
  // @ts-expect-error The condition module exposes the same read-only store.
  conditions.state.set('Bleeding', state);
  // @ts-expect-error Observation arrays cannot insert applications.
  state.stacks.push(applications[0]);
  // @ts-expect-error Queries cannot shorten accepted lifetimes.
  state.stacks[0].removedAt = 1;
  // @ts-expect-error Payout groups are private to the module.
  state.groups.clear();
  // @ts-expect-error Application results cannot change their own lifetimes.
  applications[0].removedAt = 1;
  // @ts-expect-error Returned application lists are read-only.
  applications.push(applications[0]);
  // @ts-expect-error Reactions cannot change natural expiry.
  applied.application.naturalExpiresAt = 1;
  // @ts-expect-error Reactions cannot remove accepted conditions.
  applied.application.removedAt = 1;
  // @ts-expect-error Settlement observations cannot erase credited damage.
  settled.resolved.contributions[0].application.damage = 0;
  // @ts-expect-error Tick history is read-only through observations.
  settled.resolved.contributions[0].application.damageTicks.push({ at: 1, damage: 1, fraction: 1 });
  // @ts-expect-error Internal sampling fields are not writable through an application observation.
  applied.application.bufferedRawDamage = 0;
  // @ts-expect-error Queued handles expose no mutable payout group.
  event.conditionGroup!.wakeToken = 0;
  // @ts-expect-error The runtime no longer exposes condition sampler state.
  runtime.conditionBufferAt = 1;
}
