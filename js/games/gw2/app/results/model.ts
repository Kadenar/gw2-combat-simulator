import { buildChartSeries as buildSharedChartSeries, chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import { skillDamageIdentityKey, skillDamageKeyByIdentity } from '#gw2/app/results/result-tables.js';
import { resultSummaryMetrics as transformResultSummaryMetrics } from '#gw2/app/results/result-transform.js';
import { timelineIdleTimeMetric } from '#gw2/app/rotation/timeline/timing/model.js';
import { GW2_STANDARD_BOONS, isStandardBoon, standardBoonPresentation } from '#gw2/platform/combat/state/boons.js';
import type { ProfessionEffectPresentation, SimulationEvent } from '#gw2/platform/engine/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

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

  metrics.splice(1, 0, timelineIdleTimeMetric(result));
  return metrics;
}

export { skillBreakdownRows } from '#gw2/app/results/result-tables.js';

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
