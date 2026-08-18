import type {
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent
} from '../types.js';

/**
 * Boons the configured target actually carries, capping how many a removal
 * effect can strip. Mirrors the target-config contract used by the scheduler.
 */
function configuredTargetBoonCount(context: WarriorSchedulerContext | WarriorResolverContext): number {
  const target = context.config.target;
  if (target?.boonless === true) return 0;
  if (Array.isArray(target?.boons)) {
    return new Set(target.boons.map(String)).size;
  }
  if (target?.boonCount != null) {
    return Math.max(0, Math.trunc(Number(target.boonCount) || 0));
  }
  return target?.boonless === false ? 1 : 0;
}

/**
 * Splits a boon-removal effect into attempted removals (declared by the skill)
 * and the removals that land against the configured target. Shared with the
 * Spellbreaker scheduler so Attacker's Insight counts the same landings.
 */
export function warriorBoonRemovalCounts(
  context: WarriorSchedulerContext | WarriorResolverContext,
  event: WarriorSimulationEvent | WarriorResolverEvent
): { attempted: number; removed: number } {
  const attempted = Math.max(1, Math.trunc(Number(event.attemptedBoonRemovals) || 1));
  const removed = Math.min(attempted, configuredTargetBoonCount(context));
  return { attempted, removed };
}
