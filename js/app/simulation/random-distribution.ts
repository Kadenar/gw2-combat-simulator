import type {
  LegacyRotationItem,
  SimulationEvent,
} from "../../platform/engine/types.js";
import type {
  Gw2Config,
  Gw2ProcStep,
  Gw2ResolverEvent,
} from "../../platform/gw2/types.js";
import { SIMULATION_RANDOMNESS_MODES } from "../../platform/engine/simulation-random.js";
import type {
  RandomDistributionDriver,
  RandomDistributionMetricSample,
  RandomDistributionOptions,
  RandomDistributionOutcome,
  RandomDistributionRequest,
  RandomDistributionSummary,
} from "../profession/types.js";

/** Default number of stochastic trials used by the application. */
export const DEFAULT_RANDOM_DISTRIBUTION_TRIALS = 500;

/** Maximum accepted trial count for one complete distribution. */
export const MAX_RANDOM_DISTRIBUTION_TRIALS = 10_000;

/** Maximum number of distribution workers used by the application shell. */
export const MAX_RANDOM_DISTRIBUTION_WORKERS = 8;

/** Conservative worker count when the browser does not expose CPU capacity. */
export const DEFAULT_RANDOM_DISTRIBUTION_WORKERS = 4;

const EXPLANATION_COHORT_PERCENT = 10;
const MAX_EXPLANATION_DRIVERS = 5;
const MIN_EXPLANATION_CORRELATION = 0.2;
const DRIVER_CATEGORY_PRIORITY: Readonly<Record<string, number>> =
  Object.freeze({
    condition: 0,
    effect: 1,
    proc: 2,
    critical: 3,
    "weapon-strength": 4,
  });

export interface RandomDistributionBatch {
  readonly trials: number;
  readonly seedStart: number;
}

export function randomDistributionWorkerCount(
  trialCount: number,
  hardwareConcurrency = 0,
): number {
  const trials = Math.max(
    0,
    Math.min(
      MAX_RANDOM_DISTRIBUTION_TRIALS,
      Math.trunc(Number(trialCount) || 0),
    ),
  );
  if (!trials) return 0;
  const hardware = Math.trunc(Number(hardwareConcurrency) || 0);
  const availableWorkers =
    hardware > 0
      ? Math.max(1, hardware - 1)
      : DEFAULT_RANDOM_DISTRIBUTION_WORKERS;
  return Math.min(trials, MAX_RANDOM_DISTRIBUTION_WORKERS, availableWorkers);
}

export function partitionRandomDistributionTrials(
  trialCount: number,
  workerCount: number,
): RandomDistributionBatch[] {
  const trials = Math.max(
    0,
    Math.min(
      MAX_RANDOM_DISTRIBUTION_TRIALS,
      Math.trunc(Number(trialCount) || 0),
    ),
  );
  if (!trials) return [];
  const count = Math.min(
    trials,
    Math.max(1, Math.trunc(Number(workerCount) || 1)),
  );
  const baseSize = Math.floor(trials / count);
  const remainder = trials % count;
  let seedStart = 1;
  return Array.from({ length: count }, (_unused, index) => {
    const batchTrials = baseSize + (index < remainder ? 1 : 0);
    const batch = { trials: batchTrials, seedStart };
    seedStart += batchTrials;
    return batch;
  });
}

function normalizedTrialCount(value: unknown): number {
  return Math.max(
    1,
    Math.min(
      MAX_RANDOM_DISTRIBUTION_TRIALS,
      Math.trunc(Number(value) || DEFAULT_RANDOM_DISTRIBUTION_TRIALS),
    ),
  );
}

function percentile(sortedValues: number[], probability: number): number {
  if (!sortedValues.length) return 0;
  const position =
    Math.max(0, Math.min(1, Number(probability) || 0)) *
    (sortedValues.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];
  return lower + (upper - lower) * (position - lowerIndex);
}

export function summarizeRandomDistribution(
  values: unknown[] = [],
): RandomDistributionSummary {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (!sorted.length) {
    return {
      trials: 0,
      mean: 0,
      p01: 0,
      p10: 0,
      p50: 0,
      p90: 0,
      p99: 0,
    };
  }
  return {
    trials: sorted.length,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p01: percentile(sorted, 0.01),
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
  };
}

interface DistributionSimulationResult {
  readonly dps: number;
  readonly events?: readonly SimulationEvent[];
  readonly resolvedEvents?: readonly Gw2ResolverEvent[];
  readonly procSteps?: readonly Gw2ProcStep[];
}

function metricSlug(value: unknown): string {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function effectName(event: Gw2ResolverEvent): string {
  const raw = String(
    event.name || event.skillName || event.source || event.sourceId || "Effect",
  ).trim();
  const parts = raw.split(/\s(?:\u2013|\u2014)\s/);
  return String(parts.at(-1) || raw).trim();
}

function readableProfileName(profileId: string): string {
  const raw = String(profileId.split(".").at(-1) || profileId)
    .replace(/-/g, " ")
    .trim();
  return raw.replace(/\b\w/g, (character) => character.toUpperCase());
}

function hasStrikePayload(event: Gw2ResolverEvent): boolean {
  return (
    Number(event.coefficient) > 0 ||
    Number.isFinite(event.flatDamage) ||
    Number.isFinite(event.flatStrikeBase) ||
    Number.isFinite(event.flatStrikePowerCoeff)
  );
}

function criticalMetric(event: Gw2ResolverEvent): Readonly<{
  id: string;
  label: string;
}> {
  if (
    event.source === "Clone" ||
    event.source === "Phantasm" ||
    event.actorType === "phantasm"
  ) {
    return { id: "illusion", label: "Illusion critical hits" };
  }
  if (event.actorType === "summon") {
    return { id: "summon", label: "Summon critical hits" };
  }
  if (event.actorType === "effect") {
    return { id: "effect", label: "Triggered-effect critical hits" };
  }
  return { id: "player", label: "Player critical hits" };
}

function addMetric(
  metrics: Map<string, RandomDistributionMetricSample>,
  metric: Omit<RandomDistributionMetricSample, "value">,
  value: number,
): void {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return;
  const current = metrics.get(metric.id);
  metrics.set(metric.id, {
    ...metric,
    value: Number(current?.value || 0) + numeric,
  });
}

/**
 * Reduces a native simulation result to compact, profession-neutral RNG facts.
 * Fixed facts are retained here and discarded later if they do not vary across
 * trials; this keeps profession code free of distribution-specific hooks.
 */
export function randomDistributionMetrics(
  result: DistributionSimulationResult,
): RandomDistributionMetricSample[] {
  const metrics = new Map<string, RandomDistributionMetricSample>();
  const weaponSamples = new Map<string, { total: number; count: number }>();
  const seenWeaponActivations = new Set<string>();

  for (const event of result.resolvedEvents || []) {
    if (event.type === "damage") {
      if (Number(event.coefficient) > 0 && event.didCrit === true) {
        const critical = criticalMetric(event);
        addMetric(
          metrics,
          {
            id: `critical:${critical.id}`,
            group: `critical:${critical.id}`,
            label: critical.label,
            category: "critical",
            unit: "count",
          },
          Number(event.hits || 1),
        );
      }

      if (
        event.weaponStrengthSampled === true &&
        Number.isFinite(event.resolvedWeaponStrength)
      ) {
        const profileId = String(
          event.weaponStrengthProfileId || "weapon.unknown",
        );
        const activationId = String(
          event.activationId || `event:${String(event.__order)}`,
        );
        const activationKey = `${profileId}|${activationId}`;
        if (!seenWeaponActivations.has(activationKey)) {
          seenWeaponActivations.add(activationKey);
          const current = weaponSamples.get(profileId) || {
            total: 0,
            count: 0,
          };
          current.total += Number(event.resolvedWeaponStrength);
          current.count += 1;
          weaponSamples.set(profileId, current);
        }
      }

      const triggeredEffect =
        event.actorType === "effect" ||
        ["Food", "Relic", "Sigil", "Trait"].includes(String(event.source));
      if (triggeredEffect && hasStrikePayload(event)) {
        const name = effectName(event);
        const group = `effect:${metricSlug(name)}`;
        addMetric(
          metrics,
          {
            id: `effect-hit:${String(event.sourceId)}:${metricSlug(name)}`,
            group,
            label: `${name} hits`,
            category: "effect",
            unit: "count",
          },
          Number(event.hits || 1),
        );
      }
      continue;
    }

    if (event.type === "condition" && Number(event.stacks) > 0) {
      const name = effectName(event);
      const condition = String(event.condition || "Condition");
      const group = `effect:${metricSlug(name)}`;
      const label =
        name.toLowerCase() === condition.toLowerCase()
          ? `${condition} stacks applied`
          : `${name} ${condition.toLowerCase()} stacks applied`;
      addMetric(
        metrics,
        {
          id: `condition:${String(event.sourceId)}:${metricSlug(name)}:${metricSlug(condition)}`,
          group,
          label,
          category: "condition",
          unit: "stacks",
        },
        Number(event.stacks),
      );
    }
  }

  for (const [profileId, sample] of weaponSamples) {
    if (!(sample.count > 0)) continue;
    const name = readableProfileName(profileId);
    addMetric(
      metrics,
      {
        id: `weapon-strength:${profileId}`,
        group: `weapon-strength:${profileId}`,
        label: `Average ${name} weapon strength`,
        category: "weapon-strength",
        unit: "value",
      },
      sample.total / sample.count,
    );
  }

  const seenProcs = new Set<string>();
  const addProc = (
    rawName: unknown,
    atMilliseconds: number,
    rawSourceSkill: unknown,
  ): void => {
    const name = String(rawName || "").trim();
    if (!name) return;
    const sourceSkill = String(rawSourceSkill || "");
    const key = `${metricSlug(name)}|${Math.round(atMilliseconds)}|${sourceSkill}`;
    if (seenProcs.has(key)) return;
    seenProcs.add(key);
    const group = `effect:${metricSlug(name)}`;
    addMetric(
      metrics,
      {
        id: `proc:${metricSlug(name)}`,
        group,
        label: `${name} activations`,
        category: "proc",
        unit: "count",
      },
      1,
    );
  };
  for (const event of result.events || []) {
    if (event.type !== "proc") continue;
    addProc(
      event.name || event.skillName || event.sourceId,
      Number(event.at || 0) * 1000,
      event.sourceSkill,
    );
  }
  for (const step of result.procSteps || []) {
    addProc(step.skill, Number(step.start || 0), step.sourceSkill);
  }

  return [...metrics.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function average(values: readonly number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

interface LinearRelationship {
  readonly correlation: number;
  readonly slope: number;
}

function linearRelationship(
  leftValues: readonly number[],
  rightValues: readonly number[],
): LinearRelationship {
  if (!leftValues.length || leftValues.length !== rightValues.length) {
    return { correlation: 0, slope: 0 };
  }
  const leftMean = average(leftValues);
  const rightMean = average(rightValues);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < leftValues.length; index += 1) {
    const leftDelta = leftValues[index] - leftMean;
    const rightDelta = rightValues[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return {
    correlation: denominator > 0 ? numerator / denominator : 0,
    slope: leftVariance > 0 ? numerator / leftVariance : 0,
  };
}

interface RankedDriver {
  readonly driver: RandomDistributionDriver;
  readonly group: string;
  readonly score: number;
}

/**
 * Combines worker outcomes and identifies the variable facts most associated
 * with the highest and lowest DPS deciles.
 */
export function summarizeRandomDistributionOutcomes(
  rawOutcomes: readonly RandomDistributionOutcome[] = [],
): RandomDistributionSummary {
  const outcomes = rawOutcomes.filter((outcome) =>
    Number.isFinite(Number(outcome?.dps)),
  );
  const base = summarizeRandomDistribution(
    outcomes.map((outcome) => outcome.dps),
  );
  if (outcomes.length < 2 || base.p01 === base.p99) return base;

  const ordered = [...outcomes].sort((left, right) => left.dps - right.dps);
  const cohortSize = Math.max(
    1,
    Math.ceil(ordered.length * (EXPLANATION_COHORT_PERCENT / 100)),
  );
  const low = ordered.slice(0, cohortSize);
  const high = ordered.slice(-cohortSize);
  const metadata = new Map<string, RandomDistributionMetricSample>();
  const valueMaps = new Map<
    RandomDistributionOutcome,
    ReadonlyMap<string, number>
  >();
  for (const outcome of outcomes) {
    const values = new Map<string, number>();
    for (const metric of outcome.metrics || []) {
      metadata.set(metric.id, metric);
      values.set(metric.id, Number(metric.value || 0));
    }
    valueMaps.set(outcome, values);
  }
  const valuesFor = (
    cohort: readonly RandomDistributionOutcome[],
    id: string,
  ): number[] =>
    cohort.map((outcome) => Number(valueMaps.get(outcome)?.get(id) || 0));
  const dpsValues = outcomes.map((outcome) => Number(outcome.dps));
  const ranked: RankedDriver[] = [];

  for (const [id, metric] of metadata) {
    const values = outcomes.map((outcome) =>
      Number(valueMaps.get(outcome)?.get(id) || 0),
    );
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    if (!(maximum - minimum > 1e-9)) continue;
    const lowAverage = average(valuesFor(low, id));
    const highAverage = average(valuesFor(high, id));
    const delta = highAverage - lowAverage;
    if (!(delta > 1e-9)) continue;
    const { correlation, slope } = linearRelationship(values, dpsValues);
    if (correlation < MIN_EXPLANATION_CORRELATION) continue;
    const valueMean = average(values);
    const deviation = Math.sqrt(
      average(values.map((value) => (value - valueMean) ** 2)),
    );
    const effectSize = deviation > 0 ? Math.abs(delta) / deviation : 0;
    ranked.push({
      group: metric.group,
      score: Math.abs(correlation) + Math.min(4, effectSize) / 4,
      driver: {
        id,
        label: metric.label,
        category: metric.category,
        unit: metric.unit,
        lowAverage,
        overallAverage: valueMean,
        highAverage,
        delta,
        correlation,
        estimatedDpsDelta: slope * delta,
      },
    });
  }

  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      Number(DRIVER_CATEGORY_PRIORITY[left.driver.category] || 0) -
        Number(DRIVER_CATEGORY_PRIORITY[right.driver.category] || 0) ||
      left.driver.label.localeCompare(right.driver.label),
  );
  const usedGroups = new Set<string>();
  const drivers: RandomDistributionDriver[] = [];
  for (const candidate of ranked) {
    if (usedGroups.has(candidate.group)) continue;
    usedGroups.add(candidate.group);
    drivers.push(candidate.driver);
    if (drivers.length >= MAX_EXPLANATION_DRIVERS) break;
  }
  if (!drivers.length) return base;

  return {
    ...base,
    explanation: {
      cohortPercent: EXPLANATION_COHORT_PERCENT,
      lowDpsMean: average(low.map((outcome) => outcome.dps)),
      highDpsMean: average(high.map((outcome) => outcome.dps)),
      drivers,
    },
  };
}

type SimulateForDistribution = (
  rotation: readonly LegacyRotationItem[],
  config: Gw2Config,
) => DistributionSimulationResult;

/**
 * Runs reproducible stochastic simulations and summarizes their DPS.
 */
export function calculateRandomDistribution(
  {
    rotation,
    baseConfig,
    trials = DEFAULT_RANDOM_DISTRIBUTION_TRIALS,
    seedStart = 1,
  }: RandomDistributionRequest,
  simulateBuild: SimulateForDistribution,
  { includeSamples = false, onProgress }: RandomDistributionOptions = {},
): RandomDistributionSummary {
  if (typeof simulateBuild !== "function") {
    throw new TypeError("A simulation function is required.");
  }
  const count = normalizedTrialCount(trials);
  const outcomes: RandomDistributionOutcome[] = [];
  const progressInterval = Math.max(1, Math.ceil(count / 50));
  const reportProgress = (completed: number): void =>
    onProgress?.({
      completed,
      total: count,
      percent: (completed / count) * 100,
    });
  reportProgress(0);
  for (let index = 0; index < count; index += 1) {
    const result = simulateBuild(rotation, {
      ...baseConfig,
      randomness: {
        mode: SIMULATION_RANDOMNESS_MODES.STOCHASTIC,
        // Fixed internal seeds make the aggregate stable and debuggable without
        // presenting a meaningless seed field to users.
        seed: seedStart + index,
      },
    });
    outcomes.push({
      dps: Number(result.dps || 0),
      metrics: randomDistributionMetrics(result),
    });
    const completed = index + 1;
    if (completed === count || completed % progressInterval === 0) {
      reportProgress(completed);
    }
  }
  const summary = summarizeRandomDistributionOutcomes(outcomes);
  return includeSamples
    ? {
        ...summary,
        samples: outcomes.map((outcome) => outcome.dps),
        outcomes,
      }
    : summary;
}
