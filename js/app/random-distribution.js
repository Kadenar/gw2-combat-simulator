import { SIMULATION_RANDOMNESS_MODES } from "../platform/engine/simulation-random.js";

/** Default number of stochastic trials used by the application. */
export const DEFAULT_RANDOM_DISTRIBUTION_TRIALS = 500;

/** Maximum accepted trial count for one complete distribution. */
export const MAX_RANDOM_DISTRIBUTION_TRIALS = 10_000;

/** Maximum number of distribution workers used by the application shell. */
export const MAX_RANDOM_DISTRIBUTION_WORKERS = 4;

/**
 * Chooses the worker-pool size for a requested trial count.
 *
 * The result is capped by the normalized trial count and the application
 * maximum. When hardware concurrency is known, one thread is left available
 * for the browser whenever possible.
 *
 * @param {number} trialCount Requested number of trials.
 * @param {number} [hardwareConcurrency=0] Reported logical processor count, or
 * zero when unavailable.
 * @returns {number} Worker count, or zero when there are no trials.
 */
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
  const availableWorkers =
    hardware > 0 ? Math.max(1, hardware - 1) : MAX_RANDOM_DISTRIBUTION_WORKERS;
  return Math.min(trials, MAX_RANDOM_DISTRIBUTION_WORKERS, availableWorkers);
}

/**
 * Splits trials into balanced batches with contiguous seed ranges.
 *
 * Earlier batches receive one extra trial when the work does not divide
 * evenly. Contiguous seeds keep the sampled outcomes independent of worker
 * count.
 *
 * @param {number} trialCount Requested number of trials.
 * @param {number} workerCount Requested number of worker batches.
 * @returns {Array<{trials: number, seedStart: number}>} Ordered worker batches.
 */
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

/**
 * Clamps a trial count to the supported non-empty distribution range.
 *
 * @param {*} value Requested trial count.
 * @returns {number} Integer from 1 through
 * `MAX_RANDOM_DISTRIBUTION_TRIALS`.
 */
function normalizedTrialCount(value) {
  return Math.max(
    1,
    Math.min(
      MAX_RANDOM_DISTRIBUTION_TRIALS,
      Math.trunc(Number(value) || DEFAULT_RANDOM_DISTRIBUTION_TRIALS),
    ),
  );
}

/**
 * Calculates a linearly interpolated percentile from sorted samples.
 *
 * @param {number[]} sortedValues Finite values sorted in ascending order.
 * @param {number} probability Quantile probability, clamped from 0 through 1.
 * @returns {number} Interpolated percentile, or zero for no samples.
 */
function percentile(sortedValues, probability) {
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

/**
 * Summarizes finite DPS samples.
 *
 * Non-numeric and non-finite values are discarded. An empty input produces a
 * summary whose counts and statistics are all zero.
 *
 * @param {*[]} [values=[]] Candidate DPS samples.
 * @returns {RandomDistributionSummary} Aggregate distribution statistics.
 */
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
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
  };
}

/**
 * Runs reproducible stochastic simulations and summarizes their DPS.
 *
 * Each trial receives stochastic mode and a consecutive internal seed starting
 * at `seedStart`. Progress is reported at the start, at approximately
 * two-percent intervals, and after the final trial.
 *
 * @param {RandomDistributionRequest} request Distribution inputs.
 * @param {(rotation: *[], config: Object) => {dps: number}} simulateBuild
 * Simulation function supplied by the profession runtime.
 * @param {RandomDistributionOptions} [options={}] Output and progress options.
 * @returns {RandomDistributionSummary} Summary, optionally including samples.
 * @throws {TypeError} When `simulateBuild` is not a function.
 */
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
  const reportProgress = (completed) =>
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
    dpsValues.push(Number(result.dps || 0));
    const completed = index + 1;
    if (completed === count || completed % progressInterval === 0) {
      reportProgress(completed);
    }
  }
  const summary = summarizeRandomDistribution(dpsValues);
  return includeSamples ? { ...summary, samples: dpsValues } : summary;
}
