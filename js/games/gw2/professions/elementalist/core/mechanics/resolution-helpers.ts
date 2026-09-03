/** Shared resolver-side state, attribution, boon, and condition helpers for Elementalist behavior. */
import { EPSILON } from '#kernel/core/clock.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { Gw2EventDraft } from '#gw2/platform/equipment/relics/types.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';

/** Resolves Core state whether the resolver stores it directly or under the Core module namespace. */
export function elementalistResolverCoreState(context: Gw2ResolverRuntime): ElementalistCoreState {
  const profession = context.profession as {
    core?: ElementalistCoreState;
  } & SchedulerRecord;
  return profession.core || (profession as unknown as ElementalistCoreState);
}

/** Returns the best available display name for the skill behind a resolver event. */
export function elementalistSourceSkill(event: Gw2ResolverEvent): string {
  return String(event.skillName || event.name || event.source || '');
}

// Apply derived conditions immediately so same-timestamp reactions observe the canonical resolver state.
export function applyElementalistDerivedCondition(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  {
    source,
    sourceId = event.skillId ?? event.sourceId,
    condition,
    stacks,
    duration
  }: {
    readonly source: string;
    readonly sourceId?: Gw2EventDraft['sourceId'];
    readonly condition: string;
    readonly stacks: number;
    readonly duration: number;
  }
): void {
  const application: Gw2EventDraft = {
    type: 'condition',
    at: event.at,
    source,
    sourceId,
    actorType: 'player',
    skillName: source,
    name: `${source} — ${condition}`,
    condition,
    stacks,
    duration,
    triggeredBy: elementalistSourceSkill(event)
  };
  context.applyCondition(application);
}

/** Queues a resolver-derived boon with Elementalist attribution and boon-duration scaling. */
export function queueElementalistBuff(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  kind: string,
  stacks: number,
  duration: number,
  source: string
): void {
  const adjustedDuration = gw2ResolverBoonDuration(context, event, kind, duration);
  const application: Gw2ResolverEvent = {
    type: 'buff',
    at: event.at,
    source,
    sourceId: event.skillId ?? event.sourceId ?? source,
    actorType: 'player',
    skillName: source,
    name: source,
    kind: kind.toLowerCase(),
    stacks,
    duration: adjustedDuration,
    triggeredBy: elementalistSourceSkill(event),
    ...(Number(event.priority || 0) ? { priority: Number(event.priority) } : {})
  };
  // Resolver-created buffs bypass the generic recorder, so retain them before queueing.
  context.resolved.push(application);
  enqueueOrdered(context.queue, application);
}

/** Returns active resolver-side applications of one boon kind at a timestamp. */
export function activeElementalistBuffs(context: Gw2ResolverRuntime, kind: string, at: number) {
  return (context.boons.get(kind.toLowerCase()) || []).filter(
    (application) => application.at <= at + EPSILON && application.expiresAt > at + EPSILON
  );
}

/** Rewrites every active application of a boon kind and returns the prior applications. */
export function refreshElementalistBuffs(
  context: Gw2ResolverRuntime,
  kind: string,
  at: number,
  expiresAt: (currentExpiresAt: number) => number
) {
  const normalized = kind.toLowerCase();
  const applications = context.boons.get(normalized) || [];
  const active = new Set(activeElementalistBuffs(context, normalized, at));
  context.boons.set(
    normalized,
    applications.map((application) =>
      active.has(application)
        ? {
            ...application,
            expiresAt: expiresAt(application.expiresAt)
          }
        : application
    )
  );
  return [...active];
}

/** Records a trait proc attributed to the skill whose event triggered it. */
export function recordElementalistTraitProc(context: Gw2ResolverRuntime, event: Gw2ResolverEvent, name: string): void {
  context.recordProc('trait', name, event.at, elementalistSourceSkill(event));
}
