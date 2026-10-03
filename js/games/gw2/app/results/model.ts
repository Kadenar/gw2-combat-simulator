import { buildTimeSeries, type ChartSeries } from '#gw2/app/results/charts/time-series-model.js';
import { skillDamageIdentityKey, skillDamageKeyByIdentity } from '#gw2/app/results/skill-breakdown.js';
import { baseResultSummaryMetrics } from '#gw2/app/results/summary-metrics.js';
import { timelineIdleTimeMetric } from '#gw2/app/results/idle-time-metric.js';
import { standardBoonPresentation } from '#gw2/platform/combat/boons.js';
import type {
  ProfessionChartApplication,
  ProfessionEffectPresentation
} from '#gw2/platform/profession-presentation/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

export function resultSummaryMetrics(result: Gw2SimulationResult) {
  // Metric duration follows the resolver's DPS clock. This is intentionally
  // independent from the explicit marker used as timeline display zero.
  const referenceSeconds = Math.max(0, Number(result.dpsStartTime ?? result.firstHitTime ?? 0));
  const normalizedResult =
    referenceSeconds <= 0
      ? result
      : {
          ...result,
          combatEndTime: Math.max(0, result.combatEndTime - referenceSeconds),
          deathTime: result.deathTime == null ? null : Math.max(0, Number(result.deathTime) - referenceSeconds)
        };
  const metrics = baseResultSummaryMetrics(normalizedResult);

  metrics.splice(1, 0, timelineIdleTimeMetric(result));
  // Keep input effort next to duration, using execution time rather than the resolver's DPS clock.
  const apm = result.rotationApm;
  if (apm) {
    const share = (value: number, total: number): string =>
      total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '—';
    const time = (seconds: number): string =>
      `${seconds.toFixed(1)}s — ${share(seconds, apm.durationSeconds)} of rotation`;
    const details = [
      { label: 'Non-autoattack actions', value: apm.actionCount.toLocaleString() },
      { label: 'Execution window', value: `${apm.durationSeconds.toFixed(1)}s` },
      {
        label: 'Autoattacks used',
        value: `${apm.autoattackCount} of ${apm.autoattackCount + apm.actionCount} total activations`
      },
      { label: 'Time autoattacking', value: time(apm.autoattackTimeSeconds) },
      { label: 'Time casting, including autoattacks', value: time(apm.castingTimeSeconds) },
      { label: 'Instant non-autoattack actions', value: String(apm.instantActionCount) },
      { label: 'Weapon swap inputs', value: String(apm.weaponSwapCount) },
      { label: 'Other bar swap inputs', value: String(apm.barSwapCount) },
      ...(
        [
          ['5s', apm.peak5s],
          ['10s', apm.peak10s]
        ] as const
      ).map(([window, peak]) => ({
        label: `Peak APM over ${window}`,
        value: peak
          ? `${Math.round(peak.apm)} APM (${peak.startSeconds.toFixed(1)} to ${peak.endSeconds.toFixed(1)}s)`
          : '—'
      }))
    ];
    metrics.splice(1, 0, {
      label: 'Actions / min',
      value: apm.apm == null ? '\u2014' : `${Math.round(apm.apm).toLocaleString()} APM`,
      className: 'apm',
      title: `${apm.actionCount.toLocaleString()} non-autoattack actions over ${apm.durationSeconds.toFixed(1)} seconds.\n${details.map((detail) => `${detail.label}: ${detail.value}`).join('\n')}`,
      details
    });
  }

  return metrics;
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

export function buildChartSeries(
  result: Gw2SimulationResult,
  sampleStepMs = 250,
  presentations: readonly ProfessionEffectPresentation[] = [],
  applications: readonly ProfessionChartApplication[] = []
): ChartSeries {
  // Attribute each per-hit event to the same breakdown row key the skill table
  // uses, so expanding a row shows exactly its hits in the local timeline.
  const skillKeyByIdentity = skillDamageKeyByIdentity(result);
  const series = buildTimeSeries(result, sampleStepMs, {
    effectName: (kind, event) => effectName(kind, event, presentations),
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
      ) ?? null
  });
  // Align profession-projected applications to the same observation window as damage series.
  const startMs = Number(result.dpsStartTime ?? result.firstHitTime ?? 0) * 1000;
  const skillApplications: Record<string, { t: number; label: string; empowered: boolean }[]> = {};
  for (const application of applications) {
    const t = application.at * 1000 - startMs;
    if (t < 0 || t >= series.durationMs) continue;
    (skillApplications[application.series] ||= []).push({
      t,
      label: application.label,
      empowered: application.empowered
    });
  }

  return { ...series, skillApplications };
}
