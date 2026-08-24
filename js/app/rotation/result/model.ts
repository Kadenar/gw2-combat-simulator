import type { Gw2SimulationResult } from '../../../platform/gw2/types.js';
import { durationStackingBoonCapSeconds } from '../../../platform/gw2/boon-state.js';
import { buildChartSeries as buildSharedChartSeries, chartValueAt } from '../../../platform/ui/charts.js';
import { formatTimelineDuration, timelineDeadTimeMarkers } from '../../../platform/ui/timeline.js';
import {
  skillBreakdownRows as transformSkillBreakdownRows,
  skillDamageIdentityKey,
  skillDamageKeyByIdentity
} from '../../../platform/ui/result-tables.js';
import { resultSummaryMetrics as transformResultSummaryMetrics } from '../../../platform/ui/result-transform.js';
import type { ResultSummaryMetricDetail } from '../../../platform/ui/result-transform.js';
import { shatterResourceSpends, timelineStepsWithChargeFills } from '../timeline/model.js';

const EFFECT_NAMES: Readonly<Record<string, string>> = {
  compounding: 'Compounding Power',
  'phantom-pain': 'Phantom Pain',
  'illusionary-membrane': 'Illusionary Membrane',
  'deadly-blades': 'Deadly Blades',
  'altered-chord': 'Altered Chord',
  fencer: "Fencer's Finesse",
  'mirage-cloak': 'Mirage Cloak',
  alacrity: 'Alacrity',
  protection: 'Protection',
  resolution: 'Resolution',
  vigor: 'Vigor',
  might: 'Might',
  fury: 'Fury',
  regeneration: 'Regeneration',
  swiftness: 'Swiftness',
  aegis: 'Aegis',
  'kallas-fervor': "Kalla's Fervor",
  'elemental empowerment': 'Elemental Empowerment',
  'taste-for-blood': 'Taste for Blood',
  'necromancer-soul-barbs': 'Soul Barbs',
  'berserkers-power': "Berserker's Power",
  'lethal-tempo': 'Lethal Tempo',
  'guardian-inspiring-virtue': 'Inspiring Virtue',
  'guardian-empowered-armaments': 'Empowered Armaments',
  'guardian-radiant-armaments': 'Radiant Armaments'
};

const RADIANT_ARMAMENT_NAMES: Readonly<Record<string, string>> = {
  hammer: 'Hammer',
  staff: 'Staff',
  blade: 'Sword',
  bulwark: 'Shield'
};

const EFFECT_STACK_CAPS: Readonly<Record<string, number>> = {
  Might: 25,
  Vulnerability: 25,
  "Kalla's Fervor": 5,
  'Elemental Empowerment': 10,
  'Compounding Power': 5,
  'Soul Barbs': 1,
  "Berserker's Power": 4,
  'Lethal Tempo': 5,
  'Inspiring Virtue': 1,
  'Empowered Armaments': 1,
  'Radiant Armaments': 1,
  'Radiant Armaments (Hammer)': 1,
  'Radiant Armaments (Staff)': 1,
  'Radiant Armaments (Sword)': 1,
  'Radiant Armaments (Shield)': 1,
  Berserk: 1
};

const DURATION_STACK_CAPS: Readonly<Record<string, number>> = {
  Quickness: durationStackingBoonCapSeconds('quickness'),
  Alacrity: durationStackingBoonCapSeconds('alacrity'),
  Fury: durationStackingBoonCapSeconds('fury'),
  Protection: durationStackingBoonCapSeconds('protection'),
  Vigor: durationStackingBoonCapSeconds('vigor'),
  Swiftness: durationStackingBoonCapSeconds('swiftness')
};

const BOON_EFFECTS = new Set([
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
]);

/** Groups marker durations into the concise contributor rows shown by the dead-time summary disclosure. */
function deadTimeBreakdownDetails(markers: ReturnType<typeof timelineDeadTimeMarkers>): ResultSummaryMetricDetail[] {
  const legitimateMs = markers
    .filter((marker) => marker.reason !== 'zero-damage-cast')
    .reduce((total, marker) => total + marker.durationMs, 0);
  const cancellations = new Map<string, { count: number; durationMs: number }>();
  for (const marker of markers) {
    if (marker.reason !== 'zero-damage-cast') continue;
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

  // Match the timeline's charge-aware markers so the strip includes both idle
  // gaps and zero-damage cast time caused specifically by missing interrupt commits.
  const deadTimeMarkers = timelineDeadTimeMarkers(
    timelineStepsWithChargeFills(result.steps || [], shatterResourceSpends(result)),
    result.resolvedEvents || []
  );
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

export function effectName(kind: unknown, event: Readonly<Record<string, unknown>> = {}): string {
  const key = String(kind || '');
  const name = EFFECT_NAMES[key];
  if (key === 'guardian-radiant-armaments') {
    const weapon = RADIANT_ARMAMENT_NAMES[String(event.radiantWeapon || '')];
    return weapon ? `${name} (${weapon})` : name;
  }

  if (name) return name;
  return key
    .split('-')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ''}${part.slice(1)}`)
    .join(' ');
}

export function buildChartSeries(result: Gw2SimulationResult, sampleStepMs = 250) {
  // Attribute each per-hit event to the same breakdown row key the skill table
  // uses, so clicking a row highlights exactly its hits on the chart.
  const skillKeyByIdentity = skillDamageKeyByIdentity(result);
  return buildSharedChartSeries(result, sampleStepMs, {
    effectName,
    effectType: (kind, event) =>
      event.type === 'condition' ? 'condition' : BOON_EFFECTS.has(String(kind || '').toLowerCase()) ? 'boon' : 'buff',
    replacementGroup: (kind) => (kind === 'guardian-radiant-armaments' ? String(kind) : ''),
    // Relic activation records are the authoritative source for temporary
    // relic state, including refreshes that extend the active window.
    timedProcEffect: (proc) =>
      proc.type === 'relic_proc' && proc.expiresAt != null ? { name: proc.skill, type: 'buff' } : null,
    stackCaps: EFFECT_STACK_CAPS,
    durationStackCaps: DURATION_STACK_CAPS,
    skillKey: (event) =>
      skillKeyByIdentity.get(
        skillDamageIdentityKey({
          skillId: event.skillId,
          sourceId: event.sourceId,
          actorType: event.actorType,
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
