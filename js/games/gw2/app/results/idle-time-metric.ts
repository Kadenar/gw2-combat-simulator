import type { ResultSummaryMetric, ResultSummaryMetricDetail } from '#gw2/app/results/summary-metrics.js';
import {
  formatTimelineDuration,
  shatterResourceSpends,
  timelineDeadTimeMarkers,
  timelineStepsWithChargeFills
} from '#gw2/app/rotation/timeline/model.js';
import { resultCombatReferenceMs } from '#gw2/app/shared/result-clock.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

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
