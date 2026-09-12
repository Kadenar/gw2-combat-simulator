import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  remainingDurationStackSeconds,
  isDurationStackingBoon,
  isStandardBoon,
  recordBuffApplication
} from '#gw2/platform/combat/state/boons.js';
import { eventCausalOrder } from '#kernel/events/queue.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/state/types.js';
import type { ResolvedEffectAudience, SimulationEvent } from '#gw2/platform/engine/events/types.js';

const SELF: ResolvedEffectAudience = Object.freeze({
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
});

/** Split resource integration at self-boon applications, extensions, and pooled expiry. */
export function* selfBoonIntervals(
  events: readonly SimulationEvent[],
  kind: string,
  start: number,
  end: number,
  permanent = false
) {
  // Empty or reversed resource windows cannot accrue a boon, so avoid preparing their history.
  if (end <= start) return;
  // Permanent boon assumptions keep the rate constant, so resource updates need no event-history replay.
  if (permanent) {
    if (end > start) yield { start, end, active: true };
    return;
  }

  const applications = boonApplicationsAt(
    events.filter((event) => !event.cancelled),
    kind,
    Infinity
  ).filter((application) => buffMatchesAudience(application, 'all'));
  const boundaries = [
    ...new Set(applications.map((application) => application.at).filter((at) => at > start && at < end)),
    end
  ].sort((a, b) => a - b);
  for (const boundary of boundaries) {
    // ponytail: replay this boon history per boundary; cache windows if long rotations make it costly.
    const remaining = remainingDurationStackSeconds(applications, start, {
      maximum: durationStackingBoonCapSeconds(kind)
    });
    const expiresAt = Math.min(boundary, start + remaining);
    if (expiresAt > start) yield { start, end: expiresAt, active: true };
    if (boundary > expiresAt) yield { start: expiresAt, end: boundary, active: false };
    start = boundary;
  }
}

/** Apply extensions at their own timestamp, keeping past observations and other recipients unchanged. */
export function applyBoonExtension(boons: Map<string, Gw2TimedBuffApplication[]>, event: SimulationEvent): void {
  const duration = Number(event.duration || 0);
  if (!(duration > 0)) return;
  for (const [kind, applications] of boons) {
    if (!isStandardBoon(kind) || (event.kind && event.kind !== kind) || event.excludedKind === kind) continue;
    const all = event.extensionAudience === 'all';
    if (isDurationStackingBoon(kind)) {
      const previous = applications.filter((application) => application.at <= event.at);
      const wildcardSummons = previous.some(
        (application) =>
          application.resolvedAudience.includesSummons && !application.resolvedAudience.companionIds?.length
      );
      const companionIds = wildcardSummons
        ? []
        : [...new Set(previous.flatMap((application) => application.resolvedAudience.companionIds || []))];
      const includesSelf = previous.some((application) => application.resolvedAudience.includesSelf);
      const includesSummons = previous.some((application) => application.resolvedAudience.includesSummons);
      const alliedPlayerCount = Math.max(
        0,
        ...previous.map((application) => Number(application.resolvedAudience.alliedPlayerCount || 0))
      );
      applications.push({
        at: event.at,
        expiresAt: event.at + duration,
        stacks: 1,
        extension: true,
        source: event.source,
        resolvedAudience: all
          ? {
              includesSelf,
              includesSummons,
              alliedPlayerCount,
              companionIds,
              recipientCount: Number(includesSelf) + alliedPlayerCount + companionIds.length + Number(wildcardSummons)
            }
          : SELF
      });
      continue;
    }

    // Intensity stacks keep their individual lifetimes; split at the extension boundary to preserve history.
    boons.set(
      kind,
      applications
        .flatMap((application) => {
          if (
            application.at > event.at ||
            application.expiresAt <= event.at ||
            (!all && !application.resolvedAudience.includesSelf)
          )
            return [application];
          const others = {
            ...application.resolvedAudience,
            includesSelf: false,
            recipientCount: application.resolvedAudience.recipientCount - 1
          };
          return [
            { ...application, expiresAt: event.at },
            ...(!all && others.recipientCount > 0 ? [{ ...application, at: event.at, resolvedAudience: others }] : []),
            {
              ...application,
              at: event.at,
              expiresAt: application.expiresAt + duration,
              resolvedAudience: all ? application.resolvedAudience : SELF
            }
          ];
        })
        .sort((left, right) => left.at - right.at)
    );
  }
}

/** Replay one kind's applications and extensions so scheduler/timeline queries share the resolver's rules. */
export function boonApplicationsAt(
  events: readonly SimulationEvent[],
  kind: string,
  time: number,
  fallbackDuration = 0
): Gw2TimedBuffApplication[] {
  // ponytail: replay one boon history; cache by event generation if extension-heavy runs make this costly.
  const boons = new Map<string, Gw2TimedBuffApplication[]>();
  const relevant = events
    .filter(
      (event) =>
        event.at <= time &&
        ((event.type === 'buff' && String(event.kind).toLowerCase() === kind) ||
          (event.type === 'boon_extension' && (!event.kind || event.kind === kind) && event.excludedKind !== kind))
    )
    .sort((left, right) => left.at - right.at || (eventCausalOrder(left) ?? 0) - (eventCausalOrder(right) ?? 0));
  for (const event of relevant) {
    if (event.type === 'buff') recordBuffApplication(boons, { ...event, duration: event.duration || fallbackDuration });
    else applyBoonExtension(boons, event);
  }

  return boons.get(kind) || [];
}
