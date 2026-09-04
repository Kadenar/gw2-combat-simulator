import { clamp } from '#gw2/platform/combat/numeric.js';

import type { Gw2BuffAudience } from '#gw2/platform/combat/state/types.js';
import type { ResolvedEffectAudience } from '#gw2/platform/engine/events/types.js';

interface BuffAudienceMetadata {
  readonly source?: unknown;
  readonly resolvedAudience?: ResolvedEffectAudience;
}

interface DurationStackApplication {
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
export const GW2_STANDARD_BOONS = Object.freeze([
  'aegis',
  'alacrity',
  'fury',
  'might',
  'protection',
  'quickness',
  'regeneration',
  'resistance',
  'resolution',
  'stability',
  'swiftness',
  'vigor'
] as const);
const STANDARD_BOON_SET = new Set<string>(GW2_STANDARD_BOONS);
const DURATION_STACKING_BOON_CAPS = new Map([
  ['quickness', GW2_BOON_DURATION_CAP_SECONDS],
  ['alacrity', GW2_BOON_DURATION_CAP_SECONDS],
  ['fury', GW2_BOON_DURATION_CAP_SECONDS],
  ['protection', GW2_BOON_DURATION_CAP_SECONDS],
  ['vigor', GW2_BOON_DURATION_CAP_SECONDS],
  ['swiftness', GW2_SWIFTNESS_DURATION_CAP_SECONDS]
]);

export interface StandardBoonPresentation {
  readonly name: string;
  readonly maximumStacks?: number;
  readonly maximumDuration?: number;
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
  return {
    name: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    ...(normalized === 'might' ? { maximumStacks: 25 } : {}),
    ...(DURATION_STACKING_BOON_CAPS.has(normalized)
      ? { maximumDuration: DURATION_STACKING_BOON_CAPS.get(normalized) }
      : {})
  };
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
  const matching = [...applications].filter(includes).sort((left, right) => Number(left.at) - Number(right.at));
  let remaining = 0;
  let previousTime = Number(matching[0]?.at ?? time);
  for (const application of matching) {
    const appliedAt = Number(application.at);
    if (appliedAt > time) break;
    remaining = Math.max(0, remaining - Math.max(0, appliedAt - previousTime));
    const applicationDuration = duration
      ? Number(duration(application))
      : application.duration == null
        ? Number(application.expiresAt) - appliedAt
        : Number(application.duration);
    const stacks = application.stacks == null ? 1 : Math.max(0, Number(application.stacks));
    remaining = Math.min(Math.max(0, Number(maximum)), remaining + Math.max(0, applicationDuration) * stacks);
    previousTime = appliedAt;
  }

  return Math.max(0, remaining - Math.max(0, time - previousTime));
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
