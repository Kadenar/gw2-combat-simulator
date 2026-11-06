/** Finite occurrence observation follows owned descendants without taking clock or queue authority. */
import type { createAlliedStrikeController } from '#gw2/platform/combat/state/allied-strikes.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { canonicalTime } from '#kernel/core/clock.js';

interface OccurrenceCompletionOptions {
  readonly clock: { readonly time: number };
  readonly rotationEndTime: () => number | null;
  readonly horizon: () => number | null;
  readonly ownsEffect: (event: Gw2ResolverEvent) => boolean;
  readonly pendingEffects: () => readonly { at: number; cause: Gw2ResolverEvent }[];
  readonly pendingAlliedEffects: ReturnType<typeof createAlliedStrikeController>['pendingEffects'];
  readonly resolved: () => readonly Gw2ResolverEvent[];
}

export function createOccurrenceCompletion({
  clock,
  rotationEndTime,
  horizon,
  ownsEffect,
  pendingEffects,
  pendingAlliedEffects,
  resolved
}: OccurrenceCompletionOptions): () => number {
  const sustainedPreviewDeadlines = new WeakMap<object, number>();
  /** Follow owned work and condition settlement in this run; unrelated background tasks cannot prolong it. */
  return function completionTime(): number {
    let deadline = rotationEndTime() ?? clock.time;
    for (const pending of pendingEffects()) if (ownsEffect(pending.cause)) deadline = Math.max(deadline, pending.at);
    const safetyHorizon = horizon();
    for (const pending of pendingAlliedEffects()) {
      if (!ownsEffect(pending.cause)) continue;

      const { grant } = pending;

      // A grant still live at the safety horizon, such as one sustained by an upkeep, has no finite payout to finish:
      // sample its first opportunity instead of following it past the calculation window.
      // Assumes finite allied grants expire well before the 120 s horizon (the longest, venoms, last 24 s).
      if (safetyHorizon != null && (grant.isActive?.(safetyHorizon) ?? true)) {
        if (!sustainedPreviewDeadlines.has(grant)) sustainedPreviewDeadlines.set(grant, pending.at);

        deadline = Math.max(deadline, sustainedPreviewDeadlines.get(grant)!);
      } else deadline = Math.max(deadline, pending.at);
    }

    for (const event of resolved())
      if (ownsEffect(event) && event.naturalExpiresAt != null)
        // Owner condition clocks may pay their final buffered remainder after natural expiry.
        deadline = Math.max(deadline, Number(event.naturalExpiresAt) + 1.5);
    return canonicalTime(deadline);
  };
}
