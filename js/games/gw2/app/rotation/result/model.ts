import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import { GW2_STANDARD_BOONS, isStandardBoon, standardBoonPresentation } from '#gw2/platform/combat/state/boons.js';
import {
  buildChartSeries as buildSharedChartSeries,
  chartValueAt
} from '#gw2/app/presentation/results/charts/time-series-model.js';
import { formatTimelineDuration, timelineDeadTimeMarkers } from '#gw2/app/rotation/timeline/model.js';
import {
  skillBreakdownRows as transformSkillBreakdownRows,
  skillDamageIdentityKey,
  skillDamageKeyByIdentity
} from '#gw2/app/presentation/results/result-tables.js';
import { resultSummaryMetrics as transformResultSummaryMetrics } from '#gw2/app/presentation/results/result-transform.js';
import type { ResultSummaryMetricDetail } from '#gw2/app/presentation/results/result-transform.js';
import { shatterResourceSpends, timelineStepsWithChargeFills } from '#gw2/app/rotation/timeline/model.js';
import type { ProfessionEffectPresentation, SimulationEvent } from '#gw2/platform/engine/types.js';

const STANDARD_BOON_PRESENTATIONS = GW2_STANDARD_BOONS.map(standardBoonPresentation).filter(
  (presentation) => presentation != null
);
const STANDARD_STACK_CAPS: Readonly<Record<string, number>> = Object.freeze({
  Vulnerability: 25,
  ...Object.fromEntries(
    STANDARD_BOON_PRESENTATIONS.flatMap((presentation) =>
      presentation.maximumStacks == null ? [] : [[presentation.name, presentation.maximumStacks]]
    )
  )
});
const STANDARD_DURATION_CAPS: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    STANDARD_BOON_PRESENTATIONS.flatMap((presentation) =>
      presentation.maximumDuration == null ? [] : [[presentation.name, presentation.maximumDuration]]
    )
  )
);

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

export function resultSummaryMetrics(result: Gw2SimulationResult) {
  // Metric duration follows the resolver's DPS clock. This is intentionally
  // independent from the explicit marker used as timeline display zero.
  const referenceSeconds = Math.max(0, Number(result.dpsStartTime ?? result.firstHitTime ?? 0));
  const normalizedResult =
    referenceSeconds <= 0
      ? result
      : {
          ...result,
          duration: Math.max(0, Number(result.duration || 0) - referenceSeconds),
          deathTime: result.deathTime == null ? null : Math.max(0, Number(result.deathTime) - referenceSeconds)
        };
  const metrics = transformResultSummaryMetrics(normalizedResult);

  // Match the timeline's charge-aware markers so the strip includes idle gaps
  // and the complete attempted duration of interrupted casts that never committed.
  const combatStartMs = resultCombatReferenceMs(result);
  // Pre-combat waits are setup time, so keep them on the timeline without charging them to the combat idle metric.
  const deadTimeMarkers = timelineDeadTimeMarkers(
    timelineStepsWithChargeFills(result.steps || [], shatterResourceSpends(result)),
    result.resolvedEvents || []
  ).filter((marker) => marker.reason !== 'explicit-wait' || marker.start >= combatStartMs);
  const deadTimeMs = deadTimeMarkers.reduce((total, marker) => total + marker.durationMs, 0);
  metrics.splice(1, 0, {
    label: 'Total Idle Time',
    value: formatTimelineDuration(deadTimeMs),
    className: '',
    details: deadTimeBreakdownDetails(deadTimeMarkers)
  });
  return metrics;
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

export function skillBreakdownRows(result: Gw2SimulationResult) {
  return transformSkillBreakdownRows(result);
}

/** Finds the active profession contribution for an internal effect kind. */
function effectPresentation(
  kind: unknown,
  presentations: readonly ProfessionEffectPresentation[]
): ProfessionEffectPresentation | undefined {
  const key = String(kind || '').toLowerCase();
  return presentations.find((presentation) => presentation.kind.toLowerCase() === key);
}

/** Resolves shared boon names and profession-owned labels before applying the generic fallback. */
export function effectName(
  kind: unknown,
  event: Readonly<Record<string, unknown>> = {},
  presentations: readonly ProfessionEffectPresentation[] = []
): string {
  const key = String(kind || '');
  const professionPresentation = effectPresentation(key, presentations);
  if (professionPresentation) {
    const name =
      typeof professionPresentation.name === 'function'
        ? professionPresentation.name(event as SimulationEvent)
        : professionPresentation.name;
    if (name) return name;
  }

  const standardBoon = standardBoonPresentation(key);
  if (standardBoon) return standardBoon.name;
  return key
    .split('-')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ''}${part.slice(1)}`)
    .join(' ');
}

/** Builds display-name keyed caps from the profession effects present in this result. */
function effectStackCaps(
  result: Gw2SimulationResult,
  presentations: readonly ProfessionEffectPresentation[]
): Readonly<Record<string, number>> {
  const caps: Record<string, number> = { ...STANDARD_STACK_CAPS };
  for (const event of result.events || []) {
    if (event.type !== 'buff') continue;
    const presentation = effectPresentation(event.kind, presentations);
    if (presentation?.maximumStacks == null) continue;
    caps[effectName(event.kind, event, presentations)] = presentation.maximumStacks;
  }

  return caps;
}

export function buildChartSeries(
  result: Gw2SimulationResult,
  sampleStepMs = 250,
  presentations: readonly ProfessionEffectPresentation[] = []
) {
  // Attribute each per-hit event to the same breakdown row key the skill table
  // uses, so clicking a row highlights exactly its hits on the chart.
  const skillKeyByIdentity = skillDamageKeyByIdentity(result);
  return buildSharedChartSeries(result, sampleStepMs, {
    effectName: (kind, event) => effectName(kind, event, presentations),
    effectType: (kind, event) => (event.type === 'condition' ? 'condition' : isStandardBoon(kind) ? 'boon' : 'buff'),
    replacementGroup: (kind) => effectPresentation(kind, presentations)?.replacementGroup || '',
    // Relic activation records are the authoritative source for temporary
    // relic state, including refreshes that extend the active window.
    timedProcEffect: (proc) =>
      proc.type === 'relic_proc' && proc.expiresAt != null ? { name: proc.skill, type: 'buff' } : null,
    stackCaps: effectStackCaps(result, presentations),
    durationStackCaps: STANDARD_DURATION_CAPS,
    skillKey: (event) =>
      skillKeyByIdentity.get(
        skillDamageIdentityKey({
          skillId: event.skillId,
          sourceId: event.sourceId,
          actorType: event.actorType,
          summonKind: event.summonKind,
          source: event.source,
          parentSkill: event.parentSkillName,
          name: event.name
        })
      ) ?? null,
    // Row keys are `group|name`; the display name is everything after the group.
    skillName: (key) => key.slice(key.indexOf('|') + 1)
  });
}

export { chartValueAt };
