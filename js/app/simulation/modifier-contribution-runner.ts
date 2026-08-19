import {
  mergeModifierContributions,
  modifierContributionWorkerCount,
  partitionModifierComparisons
} from './modifier-contributions.js';
import type { ModifierContribution, ProfessionAppState } from '../profession/types.js';

const MODIFIER_CONTRIBUTION_DEBOUNCE_MS = 750;

interface ModifierContributionWorkerMessage {
  readonly requestId: number;
  readonly error?: unknown;
  readonly contributions?: ModifierContribution[];
}

export class ModifierContributionRunner {
  readonly app: ProfessionAppState;
  timer: ReturnType<typeof setTimeout> | null;
  readonly workers: Set<Worker>;
  requestId: number;

  constructor(app: ProfessionAppState) {
    this.app = app;
    this.timer = null;
    this.workers = new Set();
    this.requestId = 0;
  }

  schedule(): void {
    const app = this.app;
    const requestId = ++this.requestId;
    if (this.timer !== null) clearTimeout(this.timer);
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
    const applyContributions = (contributions: ModifierContribution[]): void => {
      if (requestId !== this.requestId || !app.results) return;
      app.results.contributions = contributions;
      app.results.modifierContributionsStale = false;
      app.adapter.renderResults(app);
    };

    const failContributions = (): void => {
      if (requestId !== this.requestId || !app.results) return;
      for (const worker of this.workers) {
        worker.terminate();
      }

      this.workers.clear();
      app.results.modifierContributionsStale = false;
      app.adapter.renderResults(app);
    };

    const calculateContributions = (): void => {
      this.timer = null;
      if (requestId !== this.requestId) return;
      // Give RNG sampling uncontested CPU time. Contribution comparisons
      // start as soon as the distribution worker pool finishes.
      if (app.randomDistributionRunner.isRunning) {
        this.timer = setTimeout(calculateContributions, 250);
        return;
      }

      if (typeof Worker === 'function') {
        const workerCount = modifierContributionWorkerCount(
          request.comparisons.length,
          globalThis.navigator?.hardwareConcurrency
        );
        const batches = partitionModifierComparisons(request.comparisons, workerCount);
        if (!batches.length) {
          applyContributions([]);
          return;
        }

        const completed: ModifierContribution[][] = [];
        let failed = false;
        for (const comparisons of batches) {
          const worker = new Worker(new URL('./modifier-contribution-worker.js', import.meta.url), { type: 'module' });
          this.workers.add(worker);
          const finishWorker = (): void => {
            worker.terminate();
            this.workers.delete(worker);
          };

          worker.addEventListener('message', (event: MessageEvent<ModifierContributionWorkerMessage>) => {
            const { data } = event;
            if (failed || data.requestId !== requestId || requestId !== this.requestId) {
              return;
            }

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
            'error',
            () => {
              if (failed) return;
              failed = true;
              finishWorker();
              failContributions();
            },
            { once: true }
          );
          worker.postMessage({
            requestId,
            request: { ...request, comparisons }
          });
        }

        return;
      }

      try {
        applyContributions(app.adapter.calculateModifierContributions(request));
      } catch {
        failContributions();
      }
    };

    this.timer = setTimeout(calculateContributions, MODIFIER_CONTRIBUTION_DEBOUNCE_MS);
  }
}
