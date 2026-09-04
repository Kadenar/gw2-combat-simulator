import type { ResultSummaryMetricDetail } from '#gw2/app/results/result-transform.js';
import { type ResultSummaryMetric } from '#gw2/app/results/result-transform.js';
import {
  formatTimelineDuration,
  shatterResourceSpends,
  timelineDeadTimeMarkers,
  timelineStepsWithChargeFills
} from '#gw2/app/rotation/timeline/model.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

import type { SchedulerStep } from '#gw2/platform/engine/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

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

export function resultCombatReferenceMs(result: Gw2SimulationResult | null | undefined): number {
  const marker = result?.events?.find((event) => event.type === 'combat_start');
  if (!marker) return 0;
  return Number(marker.at || 0) * 1000;
}

export function formatTimelineTime(timeMs: unknown, referenceMs: unknown = 0, digits = 2): string {
  const precision = 10 ** digits;
  const seconds = (Number(timeMs || 0) - Number(referenceMs || 0)) / 1000;
  const normalized = Math.abs(seconds) < 0.5 / precision ? 0 : seconds;
  return `${normalized.toFixed(digits)}s`;
}

export function formatResultTimelineTime(
  timeMs: unknown,
  result: Gw2SimulationResult | null | undefined,
  digits = 2
): string {
  return formatTimelineTime(timeMs, resultCombatReferenceMs(result), digits);
}

/** Groups marker durations into the concise contributor rows shown by the dead-time summary disclosure. */
function deadTimeBreakdownDetails(markers: ReturnType<typeof timelineDeadTimeMarkers>): ResultSummaryMetricDetail[] {
  const legitimateMs = markers
    .filter((marker) => marker.reason == null)
    .reduce((total, marker) => total + marker.durationMs, 0);
  const explicitWaitMs = markers
    .filter((marker) => marker.reason === 'explicit-wait')
    .reduce((total, marker) => total + marker.durationMs, 0);
  const cancellations = new Map<string, { count: number; durationMs: number }>();
  for (const marker of markers) {
    if (marker.reason == null || marker.reason === 'explicit-wait') continue;
    const skill = marker.skill || 'Unknown skill';
    const current = cancellations.get(skill) || { count: 0, durationMs: 0 };
    current.count += 1;
    current.durationMs += marker.durationMs;
    cancellations.set(skill, current);
  }

  const details: ResultSummaryMetricDetail[] = [];
  if (legitimateMs > 0) {
    details.push({ label: 'Idle time between skills', value: formatTimelineDuration(legitimateMs) });
  }

  if (explicitWaitMs > 0) {
    details.push({ label: 'Explicit waits', value: formatTimelineDuration(explicitWaitMs) });
  }

  for (const [skill, cancellation] of cancellations) {
    details.push({
      label: `Skill cancelled '${skill}'${cancellation.count > 1 ? ` (${cancellation.count} casts)` : ''}`,
      value: formatTimelineDuration(cancellation.durationMs)
    });
  }

  return details.length ? details : [{ label: 'No idle time', value: formatTimelineDuration(0) }];
}

/** Uses charge-aware timeline gaps and cancellations for the combat idle-time summary. */
export function timelineIdleTimeMetric(result: Gw2SimulationResult): ResultSummaryMetric {
  // Match the timeline's charge-aware markers so the strip includes idle gaps
  // and the complete attempted duration of interrupted casts that never committed.
  const combatStartMs = resultCombatReferenceMs(result);
  // Pre-combat waits are setup time, so keep them on the timeline without charging them to the combat idle metric.
  const deadTimeMarkers = timelineDeadTimeMarkers(
    timelineStepsWithChargeFills(result.steps || [], shatterResourceSpends(result)),
    result.resolvedEvents || []
  ).filter((marker) => marker.reason !== 'explicit-wait' || marker.start >= combatStartMs);
  const deadTimeMs = deadTimeMarkers.reduce((total, marker) => total + marker.durationMs, 0);
  return {
    label: 'Total Idle Time',
    value: formatTimelineDuration(deadTimeMs),
    className: '',
    details: deadTimeBreakdownDetails(deadTimeMarkers)
  };
}
