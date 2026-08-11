import { clamp } from "./numeric.js";

import type { Gw2BuffAudience } from "./types.js";

interface BuffAudienceMetadata {
  readonly source?: unknown;
  readonly affectsSelf?: unknown;
  readonly affectsSummons?: unknown;
  readonly companionIds?: readonly unknown[];
}

/** Returns whether a buff application belongs to the requested actor scope. */
export function buffMatchesAudience(
  application: BuffAudienceMetadata,
  audience: Gw2BuffAudience,
  companionId?: string | null,
): boolean {
  if (audience === "all") return application.affectsSelf !== false;
  if (application.affectsSummons !== true) return false;
  if (audience === "summon-trait" && application.source !== "Trait") {
    return false;
  }
  const companionIds = Array.isArray(application.companionIds)
    ? application.companionIds.map(String).filter(Boolean)
    : [];
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
  shouldStop: ((item: T) => boolean) | null = null,
): number {
  let stacks = 0;
  for (const item of items) {
    if (shouldStop?.(item)) break;
    if (isActive(item)) stacks += weight(item);
  }
  return clamp(stacks, 0, maximum);
}
