import {
  mergeModifierContributions,
  modifierContributionWorkerCount,
  partitionModifierComparisons,
} from "./modifier-contributions.js";

const MODIFIER_CONTRIBUTION_DEBOUNCE_MS = 750;

export class ModifierContributionRunner {
  constructor(app) {
    this.app = app;
    this.timer = null;
    this.workers = new Set();
    this.requestId = 0;
  }

  schedule() {
    const app = this.app;
    const requestId = ++this.requestId;
    clearTimeout(this.timer);
    this.timer = null;
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers.clear();

    if (!app.build.rotation.length || !app.results) {
      if (app.results) app.results.modifierContributionsStale = false;
      return;
    }

    app.results.modifierContributionsStale = true;
    const request = app.adapter.modifierContributionRequest(app);
    const applyContributions = (contributions) => {
      if (requestId !== this.requestId || !app.results) return;
      app.results.contributions = contributions;
      app.results.modifierContributionsStale = false;
      app.adapter.renderResults(app);
    };
    const failContributions = () => {
      if (requestId !== this.requestId || !app.results) return;
      for (const worker of this.workers) {
        worker.terminate();
      }
      this.workers.clear();
      app.results.modifierContributionsStale = false;
      app.adapter.renderResults(app);
    };

    const calculateContributions = () => {
      this.timer = null;
      if (requestId !== this.requestId) return;
      // Give RNG sampling uncontested CPU time. Contribution comparisons
      // start as soon as the distribution worker pool finishes.
      if (app.randomDistributionRunner.isRunning) {
        this.timer = setTimeout(calculateContributions, 250);
        return;
      }

      if (typeof Worker === "function") {
        const workerCount = modifierContributionWorkerCount(
          request.comparisons.length,
          globalThis.navigator?.hardwareConcurrency,
        );
        const batches = partitionModifierComparisons(
          request.comparisons,
          workerCount,
        );
        if (!batches.length) {
          applyContributions([]);
          return;
        }
        const completed = [];
        let failed = false;
        for (const comparisons of batches) {
          const worker = new Worker(
            new URL("./modifier-contribution-worker.js", import.meta.url),
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
            finishWorker();
            if (data.error) {
              failed = true;
              failContributions();
              return;
            }
            completed.push(data.contributions || []);
            if (completed.length === batches.length) {
              applyContributions(mergeModifierContributions(completed));
            }
          });
          worker.addEventListener(
            "error",
            () => {
              if (failed) return;
              failed = true;
              finishWorker();
              failContributions();
            },
            { once: true },
          );
          worker.postMessage({
            requestId,
            request: { ...request, comparisons },
          });
        }
        return;
      }

      applyContributions(app.adapter.calculateModifierContributions(request));
    };
    this.timer = setTimeout(
      calculateContributions,
      MODIFIER_CONTRIBUTION_DEBOUNCE_MS,
    );
  }
}
