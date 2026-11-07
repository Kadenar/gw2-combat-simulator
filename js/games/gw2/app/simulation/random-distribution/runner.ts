/** Partitions RNG execution and aggregates worker progress; the lifecycle decides which outcomes remain current. */
import { ManagedWorkerBatch, type GameWorkerResponseEnvelope } from '#browser/game/managed-worker-batch.js';
import type { DistributionOperation } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import {
  partitionRandomDistributionTrials,
  randomDistributionWorkerCount,
  summarizeRandomDistributionOutcomes
} from '#gw2/app/simulation/random-distribution/random-distribution.js';
import type {
  RandomDistributionJobRequest,
  RandomDistributionOptions,
  RandomDistributionOutcome,
  RandomDistributionProgress,
  RandomDistributionSummary
} from '#gw2/app/simulation/random-distribution/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

type RandomDistributionWorkerMessage = GameWorkerResponseEnvelope &
  ({ readonly progress: RandomDistributionProgress } | { readonly outcomes: readonly RandomDistributionOutcome[] });

export class RandomDistributionRunner {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private readonly batch = new ManagedWorkerBatch<RandomDistributionWorkerMessage>();
  constructor(
    private readonly calculate: (
      request: RandomDistributionJobRequest,
      options: RandomDistributionOptions
    ) => RandomDistributionSummary
  ) {}
  cancel(): void {
    ++this.requestId;

    if (this.timer !== null) clearTimeout(this.timer);

    this.timer = null;
    this.batch.terminateAll();
  }
  run(operation: DistributionOperation): void {
    this.cancel();
    const requestId = ++this.requestId;
    const { request, baseline: results } = operation;
    const applyProgress = (progress: RandomDistributionProgress) => {
      if (requestId === this.requestId) operation.progress(progress);
    };

    const applyDistribution = (summary: RandomDistributionSummary) => {
      if (requestId === this.requestId) operation.complete(summary);
    };

    const failDistribution = (error: unknown) => {
      if (requestId === this.requestId) operation.fail(error);
    };

    this.batch.begin(requestId, failDistribution);
    this.timer = setTimeout(() => {
      this.timer = null;

      if (requestId !== this.requestId) return;

      if (typeof Worker === 'function') {
        // The full baseline shape estimates both retained result memory and transient condition-tick queue pressure.
        const conditionTicks = (results.resolvedEvents || []).reduce(
          (count, event) => count + (Array.isArray(event.damageTicks) ? event.damageTicks.length : 0),
          0
        );
        const workerCount = randomDistributionWorkerCount(request.trials, globalThis.navigator?.hardwareConcurrency, {
          scheduledEvents: results.events?.length ?? 0,
          resolvedEvents: results.resolvedEvents?.length ?? 0,
          conditionTicks
        });
        const batches = partitionRandomDistributionTrials(request.trials, workerCount);

        if (!batches.length) {
          applyDistribution(summarizeRandomDistributionOutcomes([]));
          return;
        }

        const batchProgress: number[] = batches.map(() => 0);
        // Retain each seed batch in order and aggregate its outcomes once all workers finish.
        const completedOutcomes: Array<readonly RandomDistributionOutcome[]> = batches.map(() => []);
        let completedWorkers = 0;

        batches.forEach((batch, batchIndex) => {
          if (!this.batch.isActive(requestId)) return;

          this.batch.spawn(
            // Keep Worker construction beside its static URL so Vite emits an executable worker chunk.
            () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
            requestId,
            {
              requestId,
              request: { ...request, ...batch }
            },
            (data, worker) => {
              if ('progress' in data) {
                batchProgress[batchIndex] = boundedNumber(data.progress.completed || 0, 0, 0, batch.trials);
                const completed = batchProgress.reduce((sum, value) => sum + value, 0);
                applyProgress({
                  completed,
                  total: request.trials,
                  percent: (completed / request.trials) * 100
                });
                return;
              }

              this.batch.finish(worker);
              completedOutcomes[batchIndex] = data.outcomes;
              completedWorkers += 1;

              if (completedWorkers === batches.length) {
                applyDistribution(summarizeRandomDistributionOutcomes(completedOutcomes.flat()));
              }
            }
          );
        });
        return;
      }

      try {
        applyDistribution(
          this.calculate(request, {
            onProgress: applyProgress
          })
        );
      } catch (error) {
        failDistribution(error);
      }
    }, 0);
  }
}
