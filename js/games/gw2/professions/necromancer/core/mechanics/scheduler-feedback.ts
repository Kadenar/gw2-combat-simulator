import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent
} from '#gw2/professions/necromancer/types.js';

export interface NecromancerSchedulerFeedback {
  readonly targetBelowHalfAt?: number | null;
  readonly conditionCounts?: Readonly<Record<string, number>>;
  readonly lifeForceGains?: readonly { readonly at: number; readonly amount: number }[];
}

/** Observe conditions at the requested boundary without replacing permanent target assumptions. */
export function observeTargetConditionCount(context: NecromancerCastContext, at: number): number {
  const key = `${context.commandIndex}:${context.skill.id}:${at}`;
  context.emit({
    type: 'necromancer.target-condition-count',
    at,
    source: 'necromancer',
    sourceId: context.skill.id,
    actorType: 'player',
    observationKey: key
  });
  const feedback = context.config._schedulerFeedback as NecromancerSchedulerFeedback | undefined;
  return feedback?.conditionCounts?.[key] ?? targetConditionCount({ config: context.config, time: at });
}

/** Capture the canonical live count for the next scheduler pass, including expiry and distinct-name deduplication. */
export function resolveTargetConditionCount(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  context.resolved.push({
    ...event,
    conditionCount: targetConditionCount({
      config: context.config,
      query: context.query,
      runtime: context,
      time: event.at
    })
  });
}
