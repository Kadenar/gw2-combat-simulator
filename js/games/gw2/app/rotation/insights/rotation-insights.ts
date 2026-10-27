import type { ComparisonWindowMode } from '#gw2/app/rotation/comparison-state.js';
import { rotationObservations } from '#gw2/app/rotation/insights/rotation-observations.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type {
  RotationFinding,
  RotationInsights,
  ComparisonMetric
} from '#gw2/app/rotation/insights/rotation-insights-types.js';

/** Materiality belongs to analysis, never combat configuration. Require absolute AND relative significance. */
const INSIGHT_MATERIALITY = Object.freeze({
  damage: 1000,
  damageShare: 0.001,
  relative: 0.02,
  seconds: 0.1,
  ratio: 0.02,
  stacks: 0.25,
  count: 1
});

function metric(id: string, unit: ComparisonMetric['unit'], current: number, reference: number): ComparisonMetric {
  return { id, unit, current, reference, delta: current - reference };
}

const keys = <T, U>(a: ReadonlyMap<string, T>, b: ReadonlyMap<string, U>) => new Set([...a.keys(), ...b.keys()]);

/** Compare windowed aggregates without retaining per-event evidence or speculative explanations. */
export function analyzeRotationInsights(
  current: Gw2SimulationResult,
  reference: Gw2SimulationResult,
  mode: ComparisonWindowMode = 'shared'
): RotationInsights {
  // Full runs retain each side's actual horizon; the shorter run is never extended with invented idle time or buffs.
  const currentFullDuration = Math.max(0, current.combatEndTime - current.dpsStartTime);
  const referenceFullDuration = Math.max(0, reference.combatEndTime - reference.dpsStartTime);
  const sharedDuration = Math.min(currentFullDuration, referenceFullDuration);
  const currentDuration = mode === 'full' ? currentFullDuration : sharedDuration;
  const referenceDuration = mode === 'full' ? referenceFullDuration : sharedDuration;
  const c = rotationObservations(current, currentDuration),
    r = rotationObservations(reference, referenceDuration);
  const findings: RotationFinding[] = [];
  const add = (finding: Omit<RotationFinding, 'material'>) => {
    if (!finding.metrics.some((value) => Math.abs(value.delta) > 1e-9)) return;

    const material = finding.metrics.some((value) => {
      const absolute =
        value.unit === 'damage'
          ? Math.max(INSIGHT_MATERIALITY.damage, Math.max(c.damage, r.damage) * INSIGHT_MATERIALITY.damageShare)
          : INSIGHT_MATERIALITY[value.unit];
      return (
        Math.abs(value.delta) >= absolute &&
        Math.abs(value.delta) >=
          Math.max(Math.abs(value.current), Math.abs(value.reference)) * INSIGHT_MATERIALITY.relative
      );
    });
    findings.push({ ...finding, material });
  };

  for (const id of keys(c.skills, r.skills)) {
    const a = c.skills.get(id),
      b = r.skills.get(id);
    const metrics = [
      metric('output', 'damage', a?.damage ?? 0, b?.damage ?? 0),
      metric('uses', 'count', a?.casts ?? 0, b?.casts ?? 0),
      metric('strike-hits', 'count', a?.hits ?? 0, b?.hits ?? 0)
    ];

    add({
      id: `skill:${id}`,
      category: 'skill-output',
      label: a?.label ?? b!.label,
      metrics,
      damageDifference: (a?.damage ?? 0) - (b?.damage ?? 0)
    });
  }

  for (const id of keys(c.cancellations, r.cancellations)) {
    const a = c.cancellations.get(id),
      b = r.cancellations.get(id),
      row = a ?? b!;
    add({
      id: `cancellation:${id}`,
      category: 'cancellation',
      label: row.label,
      metrics: [metric('unresolved-output', 'count', a?.count ?? 0, b?.count ?? 0)]
    });
  }

  for (const id of keys(c.idle, r.idle)) {
    add({
      id: `idle:${id}`,
      category: 'idle',
      label: id,
      metrics: [metric(id, 'seconds', c.idle.get(id) ?? 0, r.idle.get(id) ?? 0)]
    });
  }

  if (c.effectsAvailable && r.effectsAvailable) {
    for (const id of keys(c.effects, r.effects)) {
      const a = c.effects.get(id),
        b = r.effects.get(id);
      add({
        id: `buff:${id}`,
        category: 'buff',
        label: a?.label ?? b!.label,
        effect: a?.effect ?? b!.effect,
        metrics: [
          metric('uptime', 'ratio', a?.uptime ?? 0, b?.uptime ?? 0),
          metric('average-stacks', 'stacks', a?.averageStacks ?? 0, b?.averageStacks ?? 0)
        ]
      });
    }
  }

  for (const id of keys(c.procs, r.procs)) {
    const a = c.procs.get(id),
      b = r.procs.get(id);

    // A missing primary activation record cannot establish zero activations for an unaudited mechanic.
    if (!a || !b) continue;

    add({
      id: `proc:${id}`,
      category: 'proc',
      label: a.label,
      metrics: [metric('recorded-activations', 'count', a.count, b.count)]
    });
  }

  if (
    current.hasExplicitCombatStart &&
    reference.hasExplicitCombatStart &&
    current.firstHitTime != null &&
    reference.firstHitTime != null &&
    current.combatStartTime != null &&
    reference.combatStartTime != null
  ) {
    add({
      id: 'entry-delay',
      category: 'entry-delay',
      label: 'entry',
      metrics: [
        metric(
          'entry-delay',
          'seconds',
          current.firstHitTime - current.combatStartTime,
          reference.firstHitTime - reference.combatStartTime
        )
      ]
    });
  }

  // Only disjoint skill buckets carry measured damage. Associated symptoms never duplicate that impact.
  findings.sort(
    (a, b) =>
      Number(b.material) - Number(a.material) ||
      Math.abs(b.damageDifference ?? 0) - Math.abs(a.damageDifference ?? 0) ||
      a.id.localeCompare(b.id)
  );
  const invalid = current.steps.some((step) => step.invalid) || reference.steps.some((step) => step.invalid);
  const summary = (run: Gw2SimulationResult, windowDamage: number) => ({
    windowDamage,
    warnings: run.warnings
  });
  // No execution grade is manufactured, including for incompatible or incomplete references.
  return {
    window: { mode, currentDuration, referenceDuration },
    runs: { current: summary(current, c.damage), reference: summary(reference, r.damage) },
    status: invalid ? 'incompatible' : currentDuration <= 0 || referenceDuration <= 0 ? 'unavailable' : 'ready',
    findings
  };
}
