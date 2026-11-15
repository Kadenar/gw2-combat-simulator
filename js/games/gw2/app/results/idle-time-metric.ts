import type { ResultSummaryMetric, ResultSummaryMetricDetail } from '#gw2/app/results/summary-metrics.js';
import { formatTimelineDuration, timelineDeadTimeMarkers } from '#gw2/app/rotation/timeline/model.js';
import { combatDeadTimeMarkers, type TimelineOccupancySource } from '#gw2/app/rotation/timeline/occupancy.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

/** Groups marker durations into the concise contributor rows shown by the dead-time summary disclosure. */
function deadTimeBreakdownDetails(
  markers: readonly ReturnType<typeof timelineDeadTimeMarkers>[number][]
): ResultSummaryMetricDetail[] {
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
      label: `Cancelled cast '${skill}'${cancellation.count > 1 ? ` (${cancellation.count} casts)` : ''}`,
      value: formatTimelineDuration(cancellation.durationMs)
    });
  }

  return details.length ? details : [{ label: 'No idle time', value: formatTimelineDuration(0) }];
}

/** Includes idle gaps and waits alongside the cancelled cast time shown in the per-skill column. */
export function timelineIdleTimeMetric(
  result: Gw2SimulationResult,
  source: TimelineOccupancySource
): ResultSummaryMetric {
  const deadTimeMarkers = combatDeadTimeMarkers(result, source);
  const deadTimeMs = deadTimeMarkers.reduce((total, marker) => total + marker.durationMs, 0);
  return {
    label: 'Total Idle Time',
    value: formatTimelineDuration(deadTimeMs),
    className: 'idle-time',
    details: deadTimeBreakdownDetails(deadTimeMarkers)
  };
}
