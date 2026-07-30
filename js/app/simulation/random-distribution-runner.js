import {
  partitionRandomDistributionTrials,
  randomDistributionWorkerCount,
  summarizeRandomDistribution,
} from "./random-distribution.js";

export class RandomDistributionRunner {
  constructor(app) {
    this.app = app;
    this.timer = null;
    this.workers = new Set();
    this.requestId = 0;
  }

  get isRunning() {
    return this.workers.size > 0;
  }

  schedule(run = false) {
    const app = this.app;
    const requestId = ++this.requestId;
    clearTimeout(this.timer);
    this.timer = null;
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers.clear();

    const request =
      app.build.rotation.length && app.results
        ? app.adapter.randomDistributionRequest?.(app)
        : null;
    if (!request) {
      if (app.results) {
        app.results.randomDistributionRequested = false;
        app.results.randomDistributionStale = false;
      }
      return;
    }

    app.results.randomDistributionRequested = true;
    app.results.randomDistributionStale = run;
    app.results.randomDistributionTrials = request.trials;
    app.results.randomDistributionError = "";
    app.results.randomDistributionProgress = {
      completed: 0,
      total: request.trials,
      percent: 0,
    };
    if (!run) return;

    const applyProgress = (progress) => {
      if (requestId !== this.requestId || !app.results) return;
      const total = Math.max(1, Number(progress?.total || request.trials));
      const completed = Math.max(
        0,
        Math.min(total, Number(progress?.completed || 0)),
      );
      const percent = Math.max(
        0,
        Math.min(100, Number(progress?.percent ?? (completed / total) * 100)),
      );
      app.results.randomDistributionProgress = {
        completed,
        total,
        percent,
      };

      // Progress updates only touch the indicator. Remounting the full
      // result view would repeatedly rebuild tables and charts.
      const indicator = document.querySelector(
        '#rotation-results [data-role="rng-progress"]',
      );
      if (!indicator) return;
      indicator.setAttribute("aria-valuenow", String(Math.round(percent)));
      const bar = indicator.querySelector('[data-role="rng-progress-bar"]');
      if (bar) bar.style.width = `${percent}%`;
      const label = indicator.querySelector('[data-role="rng-progress-label"]');
      if (label) {
        label.textContent = `${Math.round(
          completed,
        ).toLocaleString()} / ${Math.round(total).toLocaleString()} outcomes (${Math.round(
          percent,
        )}%)`;
      }
    };

    const applyDistribution = (distribution) => {
      if (requestId !== this.requestId || !app.results) return;
      app.results.randomDistribution = distribution;
      app.results.randomDistributionStale = false;
      app.results.randomDistributionProgress = {
        completed: distribution.trials,
        total: distribution.trials,
        percent: 100,
      };
      app.results.randomDistributionError = "";
      app.adapter.renderResults(app);
    };
    const failDistribution = (error) => {
      if (requestId !== this.requestId || !app.results) return;
      for (const worker of this.workers) {
        worker.terminate();
      }
      this.workers.clear();
      app.results.randomDistributionStale = false;
      app.results.randomDistributionError =
        error instanceof Error
          ? error.message
          : String(error || "RNG distribution failed.");
      app.adapter.renderResults(app);
    };

    this.timer = setTimeout(() => {
      this.timer = null;
      if (requestId !== this.requestId) return;

      if (typeof Worker === "function") {
        const workerCount = randomDistributionWorkerCount(
          request.trials,
          globalThis.navigator?.hardwareConcurrency,
        );
        const batches = partitionRandomDistributionTrials(
          request.trials,
          workerCount,
        );
        const batchProgress = batches.map(() => 0);
        const completedSamples = batches.map(() => null);
        let completedWorkers = 0;
        let failed = false;

        batches.forEach((batch, batchIndex) => {
          const worker = new Worker(
            new URL("./random-distribution-worker.js", import.meta.url),
            { type: "module" },
          );
          this.workers.add(worker);
          const finishWorker = () => {
            worker.terminate();
            this.workers.delete(worker);
          };
          worker.addEventListener("message", ({ data }) => {
            if (
              failed ||
              data.requestId !== requestId ||
              requestId !== this.requestId
            )
              return;
            if (data.progress) {
              batchProgress[batchIndex] = Math.max(
                0,
                Math.min(batch.trials, Number(data.progress.completed || 0)),
              );
              const completed = batchProgress.reduce(
                (sum, value) => sum + value,
                0,
              );
              applyProgress({
                completed,
                total: request.trials,
                percent: (completed / request.trials) * 100,
              });
              return;
            }
            finishWorker();
            if (data.error) {
              failed = true;
              failDistribution(data.error);
              return;
            }
            completedSamples[batchIndex] = data.distribution?.samples || [];
            completedWorkers += 1;
            if (completedWorkers === batches.length) {
              applyDistribution(
                summarizeRandomDistribution(completedSamples.flat()),
              );
            }
          });
          worker.addEventListener(
            "error",
            (event) => {
              if (failed) return;
              failed = true;
              finishWorker();
              failDistribution(event?.message);
            },
            { once: true },
          );
          worker.postMessage({
            requestId,
            request: { ...request, ...batch },
            includeSamples: true,
          });
        });
        return;
      }

      try {
        applyDistribution(
          app.adapter.calculateRandomDistribution(request, {
            onProgress: applyProgress,
          }),
        );
      } catch (error) {
        failDistribution(error);
      }
    }, 0);
  }

  run() {
    this.schedule(true);
    this.app.modifierContributionRunner.schedule();
    this.app.adapter.renderResults(this.app);
  }
}
