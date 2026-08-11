import { professionCoreState } from "../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type {
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
} from "../types.js";

/**
 * Boons the configured target actually carries, capping how many a removal
 * effect can strip. Mirrors the target-config contract used by the scheduler.
 */
function configuredTargetBoonCount(
  context: WarriorSchedulerContext | WarriorResolverContext,
): number {
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
 *
 * @param {WarriorSchedulerContext | WarriorResolverContext} context
 * @param {WarriorSimulationEvent | WarriorResolverEvent} event
 */
export function warriorBoonRemovalCounts(
  context: WarriorSchedulerContext | WarriorResolverContext,
  event: WarriorSimulationEvent | WarriorResolverEvent,
): { attempted: number; removed: number } {
  const attempted = Math.max(
    1,
    Math.trunc(Number(event.attemptedBoonRemovals) || 1),
  );
  const removed = Math.min(attempted, configuredTargetBoonCount(context));
  return { attempted, removed };
}

/**
 * Base resolution for boon-removal effects emitted by core warrior skills such
 * as Breaching Strike. Records attempted/landed removals on the event and
 * publishes it so every specialization resolves the effect; Spellbreaker layers
 * Attacker's Insight on top during scheduling.
 *
 * @param {WarriorResolverContext} context
 * @param {WarriorResolverEvent} event
 */
export function reactToWarriorBoonRemoval(
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

export function reactToWarriorDamage(
  context: WarriorResolverContext,
  event: WarriorResolverEvent,
): void {
  const targetHealth = Number(context.config.target?.health || 0);
  const damageDone =
    Number(context.totals.strike || 0) + Number(context.totals.condition || 0);
  const state = professionCoreState(context);
  if (
    event.actorType !== "player" ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    damageDone < targetHealth * 0.5 ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY) ||
    event.at < Number(state.traitProcReadyAt.lesserSignetMight || 0)
  ) {
    return;
  }

  state.traitProcReadyAt.lesserSignetMight = event.at + 20;
  for (const buff of [
    { kind: "might", stacks: 10, duration: 6 },
    { kind: "signet-mastery", stacks: 1, duration: 60 },
  ]) {
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at + 1e-9,
      priority: -5,
      source: "Trait",
      sourceId: TRAIT.SIGNET_MASTERY,
      actorType: "effect",
      skillId: TRAIT.SIGNET_MASTERY,
      skillName: "Lesser Signet of Might",
      name: "Lesser Signet of Might",
      ...buff,
    });
  }
  context.recordProc(
    "trait",
    "Lesser Signet of Might",
    event.at,
    event.skillName,
    "10 might; Signet Mastery stack",
    String(context.helpers.skillsById?.get(ID.SIGNET_OF_MIGHT)?.icon || ""),
  );
}

export function reactToWarriorBuff(
  context: WarriorResolverContext,
  event: WarriorResolverEvent,
): void {
  if (
    Number(event.sourceId) !== TRAIT.PEAK_PERFORMANCE ||
    event.kind !== "peak-performance"
  ) {
    return;
  }
  context.recordProc(
    "trait",
    "Peak Performance",
    event.at,
    event.skillName,
    "+10% strike damage for 6 seconds",
  );
}
