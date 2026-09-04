import {
  partitionRandomDistributionTrials,
  randomDistributionWorkerCount,
  summarizeRandomDistribution,
  summarizeRandomDistributionOutcomes
} from '#gw2/app/simulation/random-distribution.js';
import { ManagedWorkerBatch, type GameWorkerResponseEnvelope } from '#app/simulation/game-worker-harness.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type {
  RandomDistributionOutcome,
  RandomDistributionProgress,
  RandomDistributionSummary
} from '#gw2/app/simulation/types.js';

interface RandomDistributionWorkerMessage extends GameWorkerResponseEnvelope {
  readonly progress?: { readonly completed?: number };
  readonly distribution?: {
    readonly samples?: readonly number[];
    readonly outcomes?: readonly RandomDistributionOutcome[];
  };
}

export class RandomDistributionRunner {
  readonly app: ProfessionAppState;
  timer: ReturnType<typeof setTimeout> | null;
  requestId: number;
  private readonly batch: ManagedWorkerBatch<RandomDistributionWorkerMessage>;

  constructor(app: ProfessionAppState) {
    this.app = app;
    this.timer = null;
    this.batch = new ManagedWorkerBatch();
    this.requestId = 0;
  }

  get isRunning(): boolean {
    return this.batch.isRunning;
  }

  schedule(run = false): void {
    const app = this.app;
    const requestId = ++this.requestId;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const failDistribution = (error: unknown): void => {
      if (requestId !== this.requestId || !app.results) return;
      app.results.randomDistributionStale = false;
      app.results.randomDistributionError =
        error instanceof Error ? error.message : String(error || 'Randomized DPS calculation failed.');
      app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));
    };

    // Each requested distribution replaces the prior pool and invalidates its pending responses.
    this.batch.begin(requestId, failDistribution);

    const results = app.results;
    if (!results || !app.build.rotation.length) {
      if (results) {
        results.randomDistributionRequested = false;
        results.randomDistributionStale = false;
      }

      return;
    }

    const request = app.adapter.randomDistributionRequest(app);
    if (!request) {
      results.randomDistributionRequested = false;
      results.randomDistributionStale = false;
      return;
    }

    results.randomDistributionRequested = true;
    results.randomDistributionStale = run;
    results.randomDistributionTrials = request.trials;
    results.randomDistributionError = '';
    results.randomDistributionProgress = {
      completed: 0,
      total: request.trials,
      percent: 0
    };
    if (!run) return;

    const applyProgress = (progress: RandomDistributionProgress): void => {
      if (requestId !== this.requestId || !app.results) return;
      const total = Math.max(1, Number(progress?.total || request.trials));
      const completed = Math.max(0, Math.min(total, Number(progress?.completed || 0)));
      const percent = Math.max(0, Math.min(100, Number(progress?.percent ?? (completed / total) * 100)));
      app.results.randomDistributionProgress = {
        completed,
        total,
        percent
      };

      // Progress updates only touch the indicator. Remounting the full
      // result view would repeatedly rebuild tables and charts.
      const indicator = document.querySelector('#rotation-results [data-role="rng-progress"]');
      if (!indicator) return;
      indicator.setAttribute('aria-valuenow', String(Math.round(percent)));
      const bar = indicator.querySelector<HTMLElement>('[data-role="rng-progress-bar"]');
      if (bar) bar.style.width = `${percent}%`;
      const label = indicator.querySelector('[data-role="rng-progress-label"]');
      if (label) {
        label.textContent = `${Math.round(
          completed
        ).toLocaleString()} / ${Math.round(total).toLocaleString()} simulations (${Math.round(percent)}%)`;
      }
    };

    const applyDistribution = (distribution: RandomDistributionSummary): void => {
      if (requestId !== this.requestId || !app.results) return;
      app.results.randomDistribution = distribution;
      app.results.randomDistributionStale = false;
      app.results.randomDistributionProgress = {
        completed: distribution.trials,
        total: distribution.trials,
        percent: 100
      };
      app.results.randomDistributionError = '';
      app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));
    };

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
          applyDistribution(summarizeRandomDistribution([]));
          return;
        }

        const batchProgress: number[] = batches.map(() => 0);
        const completedSamples: Array<readonly number[] | null> = batches.map(() => null);
        const completedOutcomes: Array<readonly RandomDistributionOutcome[] | null> = batches.map(() => null);
        let completedWorkers = 0;

        batches.forEach((batch, batchIndex) => {
          if (!this.batch.isActive(requestId)) return;
          this.batch.spawn(
            // Keep Worker construction beside its static URL so Vite emits an executable worker chunk.
            () => new Worker(new URL('./random-distribution-worker.js', import.meta.url), { type: 'module' }),
            requestId,
            {
              requestId,
              request: { ...request, ...batch },
              includeSamples: true
            },
            (data, worker) => {
              if (data.progress) {
                batchProgress[batchIndex] = Math.max(0, Math.min(batch.trials, Number(data.progress.completed || 0)));
                const completed = batchProgress.reduce((sum, value) => sum + value, 0);
                applyProgress({
                  completed,
                  total: request.trials,
                  percent: (completed / request.trials) * 100
                });
                return;
              }

              this.batch.finish(worker);
              completedSamples[batchIndex] = data.distribution?.samples || [];
              completedOutcomes[batchIndex] = data.distribution?.outcomes || [];
              completedWorkers += 1;
              if (completedWorkers === batches.length) {
                const outcomes = completedOutcomes.flatMap((batchOutcomes) => batchOutcomes || []);
                applyDistribution(
                  outcomes.length
                    ? summarizeRandomDistributionOutcomes(outcomes)
                    : summarizeRandomDistribution(completedSamples.flatMap((samples) => samples || []))
                );
              }
            }
          );
        });
        return;
      }

      try {
        applyDistribution(
          app.adapter.calculateRandomDistribution(request, {
            onProgress: applyProgress
          })
        );
      } catch (error) {
        failDistribution(error);
      }
    }, 0);
  }

  run(): void {
    this.schedule(true);
    this.app.modifierContributionRunner.schedule();
    this.app.adapter.presentation.render(this.app, this.app.adapter.presentation.createViewModel(this.app));
  }
}
