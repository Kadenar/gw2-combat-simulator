import {
  SIMULATION_RANDOMNESS_MODES,
} from "../platform/engine/simulation-random.js";

export const DEFAULT_RANDOM_DISTRIBUTION_TRIALS = 500;
export const MAX_RANDOM_DISTRIBUTION_TRIALS = 10_000;
export const MAX_RANDOM_DISTRIBUTION_WORKERS = 4;

export function randomDistributionWorkerCount(
  trialCount,
  hardwareConcurrency = 0,
) {
  const trials = Math.max(
    0,
    Math.min(
      MAX_RANDOM_DISTRIBUTION_TRIALS,
      Math.trunc(Number(trialCount) || 0),
    ),
  );
  if (!trials) return 0;
  const hardware = Math.trunc(Number(hardwareConcurrency) || 0);
  const availableWorkers = hardware > 0
    ? Math.max(1, hardware - 1)
    : MAX_RANDOM_DISTRIBUTION_WORKERS;
  return Math.min(
    trials,
    MAX_RANDOM_DISTRIBUTION_WORKERS,
    availableWorkers,
  );
}

export function partitionRandomDistributionTrials(trialCount, workerCount) {
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

function normalizedTrialCount(value) {
  return Math.max(
    1,
    Math.min(
      MAX_RANDOM_DISTRIBUTION_TRIALS,
      Math.trunc(Number(value) || DEFAULT_RANDOM_DISTRIBUTION_TRIALS),
    ),
  );
}

function percentile(sortedValues, probability) {
  if (!sortedValues.length) return 0;
  const position = Math.max(
    0,
    Math.min(1, Number(probability) || 0),
  ) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];
  return lower + (upper - lower) * (position - lowerIndex);
}

export function summarizeRandomDistribution(values = []) {
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
    p10: percentile(sorted, 0.10),
    p50: percentile(sorted, 0.50),
    p90: percentile(sorted, 0.90),
    p99: percentile(sorted, 0.99),
  };
}

export function calculateRandomDistribution(
  {
    rotation,
    baseConfig,
    trials = DEFAULT_RANDOM_DISTRIBUTION_TRIALS,
    seedStart = 1,
  },
  simulateBuild,
  { includeSamples = false, onProgress } = {},
) {
  if (typeof simulateBuild !== "function") {
    throw new TypeError("A simulation function is required.");
  }
  const count = normalizedTrialCount(trials);
  const dpsValues = [];
  const progressInterval = Math.max(1, Math.ceil(count / 50));
  const reportProgress = completed => onProgress?.({
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
    dpsValues.push(Number(result.dps || 0));
    const completed = index + 1;
    if (completed === count || completed % progressInterval === 0) {
      reportProgress(completed);
    }
  }
  const summary = summarizeRandomDistribution(dpsValues);
  return includeSamples ? { ...summary, samples: dpsValues } : summary;
}
