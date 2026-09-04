import type { SchedulerStep, SkillId } from '#gw2/platform/engine/types.js';

export interface SkillTimingOccurrence {
  readonly rotationIndex: number;
  readonly startMs: number;
  readonly intervalMs: number | null;
}

export interface SkillTimingAnalysis {
  readonly skillId: SkillId;
  readonly occurrences: readonly SkillTimingOccurrence[];
  readonly useCount: number;
  readonly averageIntervalMs: number | null;
  readonly fastestIntervalMs: number | null;
  readonly slowestIntervalMs: number | null;
}

export interface StateTimingTransition {
  readonly atMs: number;
  readonly active: boolean;
}

export interface StateTimingOccurrence {
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly endedAtTimelineEnd: boolean;
}

export interface StateTimingAnalysis {
  readonly occurrences: readonly StateTimingOccurrence[];
  readonly useCount: number;
  readonly averageDurationMs: number | null;
  readonly shortestDurationMs: number | null;
  readonly longestDurationMs: number | null;
}

/** Pairs authoritative active/inactive transitions and closes a still-active final stay at the timeline end. */
export function stateTimingAnalysis(
  transitions: readonly StateTimingTransition[] = [],
  timelineEndMs = 0
): StateTimingAnalysis {
  const ordered = transitions
    .filter((transition) => Number.isFinite(Number(transition.atMs)))
    .map((transition, index) => ({ ...transition, index }))
    .sort((left, right) => left.atMs - right.atMs || left.index - right.index);
  const occurrences: StateTimingOccurrence[] = [];
  let activeSince: number | null = null;

  for (const transition of ordered) {
    if (transition.active) {
      if (activeSince == null) activeSince = transition.atMs;
    } else if (activeSince != null) {
      occurrences.push({
        startMs: activeSince,
        endMs: transition.atMs,
        durationMs: Math.max(0, transition.atMs - activeSince),
        endedAtTimelineEnd: false
      });
      activeSince = null;
    }
  }

  if (activeSince != null) {
    const endMs = Math.max(activeSince, Number.isFinite(Number(timelineEndMs)) ? Number(timelineEndMs) : activeSince);
    occurrences.push({
      startMs: activeSince,
      endMs,
      durationMs: endMs - activeSince,
      endedAtTimelineEnd: true
    });
  }

  const durations = occurrences.map((occurrence) => occurrence.durationMs);
  return {
    occurrences,
    useCount: occurrences.length,
    averageDurationMs: durations.length
      ? durations.reduce((total, duration) => total + duration, 0) / durations.length
      : null,
    shortestDurationMs: durations.length ? Math.min(...durations) : null,
    longestDurationMs: durations.length ? Math.max(...durations) : null
  };
}

/** Groups completed casts by stable ID so every interval is measured only against the same skill. */
export function skillTimingAnalyses(
  skillIds: readonly SkillId[] = [],
  steps: readonly SchedulerStep[] = []
): SkillTimingAnalysis[] {
  const seen = new Set<SkillId>();
  return skillIds
    .filter((skillId) => {
      if (seen.has(skillId)) return false;
      seen.add(skillId);
      return true;
    })
    .map((skillId) => {
      const matches = steps
        .filter(
          (step) =>
            !step.invalid &&
            step.skillId === skillId &&
            Number.isInteger(Number(step.ri)) &&
            Number.isFinite(Number(step.start))
        )
        .sort((left, right) => Number(left.start) - Number(right.start) || Number(left.ri) - Number(right.ri));
      const occurrences = matches.map((step, index): SkillTimingOccurrence => ({
        rotationIndex: Number(step.ri),
        startMs: Number(step.start),
        intervalMs: index === 0 ? null : Number(step.start) - Number(matches[index - 1].start)
      }));
      const intervals = occurrences
        .map((occurrence) => occurrence.intervalMs)
        .filter((interval): interval is number => interval != null);
      return {
        skillId,
        occurrences,
        useCount: occurrences.length,
        averageIntervalMs: intervals.length
          ? intervals.reduce((total, interval) => total + interval, 0) / intervals.length
          : null,
        fastestIntervalMs: intervals.length ? Math.min(...intervals) : null,
        slowestIntervalMs: intervals.length ? Math.max(...intervals) : null
      };
    });
}

export interface WeaponSetDurationOptions {
  readonly startingWeaponSet?: number;
  readonly timelineEndMs?: number;
  readonly hasSecondWeaponSet?: boolean;
  readonly weaponSwapSkillIds?: ReadonlySet<SkillId>;
}

export interface WeaponSetActiveSegment {
  readonly weaponSet: 1 | 2;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
}

/** Produces one stay per real equipped-set activation so repeated manifest rows retain their own durations. */
export function weaponSetActiveSegments(
  steps: readonly SchedulerStep[] = [],
  {
    startingWeaponSet = 1,
    timelineEndMs = 0,
    hasSecondWeaponSet = false,
    weaponSwapSkillIds = new Set<SkillId>()
  }: WeaponSetDurationOptions = {}
): readonly WeaponSetActiveSegment[] {
  const timelineStartMs = Math.min(
    0,
    ...steps.filter((step) => !step.invalid && Number.isFinite(Number(step.start))).map((step) => Number(step.start))
  );
  const timelineEnd = Math.max(timelineStartMs, Number.isFinite(Number(timelineEndMs)) ? Number(timelineEndMs) : 0);
  if (!hasSecondWeaponSet) {
    return [{ weaponSet: 1, startMs: timelineStartMs, endMs: timelineEnd, durationMs: timelineEnd - timelineStartMs }];
  }

  const segments: WeaponSetActiveSegment[] = [];
  let activeSet: 1 | 2 = Number(startingWeaponSet) === 2 ? 2 : 1;
  let segmentStart = timelineStartMs;
  const swaps = steps
    .filter(
      (step) =>
        !step.invalid &&
        step.skillId != null &&
        weaponSwapSkillIds.has(step.skillId) &&
        Number.isFinite(Number(step.end))
    )
    .sort((left, right) => Number(left.end) - Number(right.end) || Number(left.ri) - Number(right.ri));

  for (const swap of swaps) {
    const at = Math.max(segmentStart, Math.min(timelineEnd, Number(swap.end)));
    segments.push({ weaponSet: activeSet, startMs: segmentStart, endMs: at, durationMs: at - segmentStart });
    activeSet = activeSet === 1 ? 2 : 1;
    segmentStart = at;
  }

  segments.push({
    weaponSet: activeSet,
    startMs: segmentStart,
    endMs: timelineEnd,
    durationMs: timelineEnd - segmentStart
  });
  return segments;
}

/** Sums every stay for each equipped set while keeping aggregate reporting separate from row presentation. */
export function weaponSetDurationTotals(
  steps: readonly SchedulerStep[] = [],
  options: WeaponSetDurationOptions = {}
): ReadonlyMap<number, number> {
  const totals = new Map<number, number>();
  for (const segment of weaponSetActiveSegments(steps, options)) {
    totals.set(segment.weaponSet, (totals.get(segment.weaponSet) || 0) + segment.durationMs);
  }

  return totals;
}
