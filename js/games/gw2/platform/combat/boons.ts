import type { ResolvedEffectAudience, SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2SigilSet } from '#gw2/platform/equipment/sigils/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { gw2EffectExpiresAt, roundEffectDuration } from '#gw2/platform/skills/timing.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { canonicalEvent, eventCausalOrder } from '#kernel/events/queue.js';
import { clamp } from '#kernel/core/numeric.js';

interface BuffAudienceMetadata {
  readonly source?: unknown;
  readonly resolvedAudience?: ResolvedEffectAudience;
}

interface DurationStackApplication {
  readonly extension?: boolean;
  readonly at: unknown;
  readonly duration?: unknown;
  readonly expiresAt?: unknown;
  readonly stacks?: unknown;
}

interface DurationStackOptions<T> {
  readonly includes?: (application: T) => boolean;
  readonly duration?: (application: T) => number;
  readonly maximum?: number;
}

export const GW2_BOON_DURATION_CAP_SECONDS = 30;
export const GW2_SWIFTNESS_DURATION_CAP_SECONDS = 60;
// Standard metadata is shared by combat stacking and presentation; Aegis and Stability keep their existing treatment.
const STANDARD_BOON_DEFINITIONS: Readonly<Record<string, StandardBoonPresentation>> = Object.freeze({
  aegis: Object.freeze({ name: 'Aegis' }),
  alacrity: Object.freeze({ name: 'Alacrity', maximumDuration: GW2_BOON_DURATION_CAP_SECONDS }),
  fury: Object.freeze({ name: 'Fury', maximumDuration: GW2_BOON_DURATION_CAP_SECONDS }),
  might: Object.freeze({ name: 'Might', maximumStacks: 25 }),
  protection: Object.freeze({ name: 'Protection', maximumDuration: GW2_BOON_DURATION_CAP_SECONDS }),
  quickness: Object.freeze({ name: 'Quickness', maximumDuration: GW2_BOON_DURATION_CAP_SECONDS }),
  regeneration: Object.freeze({ name: 'Regeneration', maximumDuration: GW2_BOON_DURATION_CAP_SECONDS }),
  resistance: Object.freeze({ name: 'Resistance', maximumDuration: GW2_BOON_DURATION_CAP_SECONDS }),
  resolution: Object.freeze({ name: 'Resolution', maximumDuration: GW2_BOON_DURATION_CAP_SECONDS }),
  stability: Object.freeze({ name: 'Stability' }),
  swiftness: Object.freeze({ name: 'Swiftness', maximumDuration: GW2_SWIFTNESS_DURATION_CAP_SECONDS }),
  vigor: Object.freeze({ name: 'Vigor', maximumDuration: GW2_BOON_DURATION_CAP_SECONDS })
});
export const GW2_STANDARD_BOONS = Object.freeze(Object.keys(STANDARD_BOON_DEFINITIONS));
const STANDARD_BOON_SET = new Set(GW2_STANDARD_BOONS);
const DURATION_STACKING_BOON_CAPS = new Map(
  Object.entries(STANDARD_BOON_DEFINITIONS).flatMap(([kind, definition]) =>
    definition.maximumDuration == null ? [] : [[kind, definition.maximumDuration] as const]
  )
);

export interface StandardBoonPresentation {
  readonly name: string;
  readonly maximumStacks?: number;
  readonly maximumDuration?: number;
}

interface BuffStackApplication extends BuffAudienceMetadata {
  readonly at: number;
  readonly duration?: number;
  readonly expiresAt?: number;
  readonly stacks?: number;
  readonly extension?: boolean;
}

/** Query only the supplied history; callers retain ownership of phase visibility and permanent assumptions. */
export function buffApplicationStacks<T extends BuffStackApplication>(
  applications: readonly T[],
  kind: string,
  time: number,
  maximum: number,
  {
    audience = 'all',
    companionId,
    duration,
    start = 0,
    ordered = false,
    includes = (application: T): boolean => buffMatchesAudience(application, audience, companionId)
  }: {
    readonly audience?: Gw2BuffAudience;
    readonly companionId?: string | null;
    readonly duration?: (application: T) => number;
    readonly start?: number;
    readonly ordered?: boolean;
    readonly includes?: (application: T) => boolean;
  } = {}
): number {
  if (isDurationStackingBoon(kind)) {
    const remaining = remainingDurationStackSeconds(applications, time, {
      includes,
      duration,
      maximum: durationStackingBoonCapSeconds(kind)
    });
    return remaining > 0 ? clamp(1, 0, maximum) : 0;
  }

  let stacks = 0;
  for (let index = start; index < applications.length; index += 1) {
    const application = applications[index];
    if (ordered && canonicalTime(application.at) > canonicalTime(time)) break;
    if (!includes(application)) continue;
    const expiresAt =
      application.expiresAt ??
      gw2EffectExpiresAt(application.at, duration ? duration(application) : Number(application.duration || 0));
    if (isTimeInWindow(time, application.at, expiresAt)) {
      stacks += Number(application.stacks || 1);
    }
  }

  return clamp(stacks, 0, maximum);
}

/** Round final boon grants and extension amounts after bonuses, preserving application times and generic buffs. */
export function normalizeBoonDuration<
  T extends { readonly type: string; readonly kind?: unknown; readonly duration?: unknown }
>(event: T): T {
  if (
    event.duration == null ||
    !(event.type === 'boon_extension' || (event.type === 'buff' && isStandardBoon(event.kind)))
  )
    return event;
  const duration = roundEffectDuration(Number(event.duration));
  return duration === event.duration ? event : { ...event, duration };
}

/** Records prepared buffs without pruning history so both phases can query earlier timestamps. */
export function recordBuffApplication(
  boons: Map<string, Gw2TimedBuffApplication[]>,
  event: SimulationEvent
): Gw2TimedBuffApplication[] {
  event = normalizeBoonDuration(event);
  if (!event.resolvedAudience) throw new TypeError('Prepared buff events require resolvedAudience.');
  const kind = String(event.kind || '').toLowerCase();
  const applications = boons.get(kind) || [];
  const at = canonicalTime(event.at);
  const duration = Math.max(0, Number(event.duration || 0));
  applications.push({
    at,
    expiresAt: gw2EffectExpiresAt(at, duration),
    ...(isDurationStackingBoon(kind) ? { duration } : {}),
    stacks: Math.max(1, Number(event.stacks || 1)),
    source: event.source,
    resolvedAudience: event.resolvedAudience
  });
  boons.set(kind, applications);
  return applications;
}

/** Restricts boon-only rules to GW2's standard boon set. */
export function isStandardBoon(kind: unknown): boolean {
  return STANDARD_BOON_SET.has(String(kind || '').toLowerCase());
}

/** Returns whether repeated applications add duration instead of intensity. */
export function isDurationStackingBoon(kind: unknown): boolean {
  return DURATION_STACKING_BOON_CAPS.has(String(kind || '').toLowerCase());
}

/** Returns the in-game duration cap for a duration-stacking boon. */
export function durationStackingBoonCapSeconds(kind: unknown): number {
  return DURATION_STACKING_BOON_CAPS.get(String(kind || '').toLowerCase()) ?? GW2_BOON_DURATION_CAP_SECONDS;
}

/** Supplies shared labels and caps for standard boons so result views do not redeclare GW2 rules. */
export function standardBoonPresentation(kind: unknown): StandardBoonPresentation | null {
  const normalized = String(kind || '').toLowerCase();
  if (!STANDARD_BOON_SET.has(normalized)) return null;
  return { ...STANDARD_BOON_DEFINITIONS[normalized] };
}

/**
 * Returns the remaining duration pool after chronological applications have
 * added their seconds and the active pool has drained at one second per second.
 */
export function remainingDurationStackSeconds<T extends DurationStackApplication>(
  applications: Iterable<T>,
  time: number,
  { includes = () => true, duration, maximum = Infinity }: DurationStackOptions<T> = {}
): number {
  // Pool depletion uses the same precision as availability, so an expired pool cannot be revived by numeric noise.
  const normalize = (value: number): number => (value === Infinity ? Infinity : canonicalTime(value));
  time = normalize(time);
  const matching = [...applications].filter(includes).sort((left, right) => Number(left.at) - Number(right.at));
  let remaining = 0;
  let previousTime = Number(matching[0]?.at ?? time);
  for (const application of matching) {
    const appliedAt = canonicalTime(Number(application.at));
    if (appliedAt > time) break;
    remaining = normalize(Math.max(0, remaining - Math.max(0, appliedAt - previousTime)));
    // Extensions add seconds only to an existing pool, without resurrecting an expired boon.
    if (application.extension && remaining <= 0) {
      previousTime = appliedAt;
      continue;
    }

    const applicationDuration = duration
      ? Number(duration(application))
      : application.duration == null
        ? Number(application.expiresAt) - appliedAt
        : Number(application.duration);
    const stacks = application.stacks == null ? 1 : Math.max(0, Number(application.stacks));
    remaining = normalize(
      Math.min(Math.max(0, Number(maximum)), remaining + Math.max(0, applicationDuration) * stacks)
    );
    if (remaining > 0) remaining = normalize(gw2EffectExpiresAt(appliedAt, remaining) - appliedAt);
    previousTime = appliedAt;
  }

  return normalize(Math.max(0, remaining - Math.max(0, time - previousTime)));
}

/** Returns whether a buff application belongs to the requested actor scope. */
export function buffMatchesAudience(
  application: BuffAudienceMetadata,
  audience: Gw2BuffAudience,
  companionId?: string | null
): boolean {
  const resolvedAudience = application.resolvedAudience;
  if (!resolvedAudience) return false;
  if (audience === 'all') return resolvedAudience.includesSelf;
  if (!resolvedAudience.includesSummons) return false;
  if (audience === 'summon-trait' && application.source !== 'Trait') {
    return false;
  }

  const companionIds = resolvedAudience.companionIds;
  return (
    companionIds.length === 0 ||
    companionId === undefined ||
    (companionId !== null && companionIds.includes(companionId))
  );
}

/**
 * Sums active stack weights and applies the requested game cap once. The
 * optional stop predicate lets chronological indexes skip future entries.
 */
export function sumActiveStacks<T>(
  items: Iterable<T>,
  isActive: (item: T) => boolean,
  weight: (item: T) => number,
  maximum: number,
  shouldStop: ((item: T) => boolean) | null = null
): number {
  let stacks = 0;
  for (const item of items) {
    if (shouldStop?.(item)) break;
    if (isActive(item)) stacks += weight(item);
  }

  return clamp(stacks, 0, maximum);
}

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
  event = normalizeBoonDuration(canonicalEvent(event));
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
        duration,
        expiresAt: gw2EffectExpiresAt(event.at, duration),
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
            !isTimeInWindow(event.at, application.at, application.expiresAt) ||
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
              expiresAt: gw2EffectExpiresAt(application.expiresAt, duration),
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
    .map(canonicalEvent)
    .filter(
      (event) =>
        event.at <= (time === Infinity ? Infinity : canonicalTime(time)) &&
        ((event.type === 'buff' && String(event.kind).toLowerCase() === kind) ||
          (event.type === 'boon_extension' && (!event.kind || event.kind === kind) && event.excludedKind !== kind))
    )
    .sort((left, right) => left.at - right.at || (eventCausalOrder(left) ?? 0) - (eventCausalOrder(right) ?? 0));
  for (const event of relevant) {
    if (event.type === 'buff') recordBuffApplication(boons, { ...event, duration: event.duration ?? fallbackDuration });
    else applyBoonExtension(boons, event);
  }

  return boons.get(kind) || [];
}

export type Gw2BuffAudience = 'all' | 'summon' | 'summon-trait';

export interface Gw2TimedBuffApplication {
  readonly extension?: boolean;
  readonly at: number;
  readonly duration?: number;
  readonly expiresAt: number;
  readonly stacks: number;
  readonly source?: string;
  readonly resolvedAudience: ResolvedEffectAudience;
}

// Small, side-effect-free GW2 rules shared by schedulers, resolvers, and
// profession adapters.

/** Power and Condition Damage granted by one stack of Might. */
export const MIGHT_ATTRIBUTE_BONUS_PER_STACK = 30;

/** Cap ordinary bonuses before adding effects that explicitly exceed the boon-duration cap. */
export function gw2BoonDurationMultiplier(boon: string, stats: Gw2Stats, sigils: Gw2SigilSet = {}): number {
  const canonicalBoon = boon.charAt(0).toUpperCase() + boon.slice(1).toLowerCase();
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(stats.boonDurationBonus || 0) / 100 +
    Number(stats.boonDurationBonuses?.[boon] || stats.boonDurationBonuses?.[canonicalBoon] || 0) / 100 +
    Number(sigils.boonDurationBonus || 0) / 100;
  return clamp(1 + bonus, 1, 2) + Math.max(0, Number(stats.uncappedBoonDurationBonus || 0)) / 100;
}
