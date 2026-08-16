import type { WarriorResolverContext, WarriorResolverEvent } from "../types.js";
import { warriorBoonRemovalCounts } from "./shared.js";

/**
 * Resolves boon-removal effects emitted by core Warrior skills and publishes
 * the attempted and landed removal counts on the resolved event.
 */
export function handleWarriorBoonRemoval(
  context: WarriorResolverContext,
  event: WarriorResolverEvent,
): void {
  const { attempted, removed } = warriorBoonRemovalCounts(context, event);
  Object.assign(event, {
    attemptedBoonRemovals: attempted,
    boonsRemoved: removed,
  });
  context.resolved.push(event);
}
