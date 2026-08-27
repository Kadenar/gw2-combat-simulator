import {
  mergeModifierContributions,
  modifierContributionWorkerCount,
  partitionModifierComparisons
} from './modifier-contributions.js';
import { ManagedWorkerBatch, type ProfessionWorkerResponseEnvelope } from './profession-worker-harness.js';
import type { ModifierContribution, ProfessionAppState } from '../profession/types.js';

const MODIFIER_CONTRIBUTION_DEBOUNCE_MS = 750;

interface ModifierContributionWorkerMessage extends ProfessionWorkerResponseEnvelope {
  readonly contributions?: ModifierContribution[];
}

export class ModifierContributionRunner {
  readonly app: ProfessionAppState;
  timer: ReturnType<typeof setTimeout> | null;
  requestId: number;
  private readonly batch: ManagedWorkerBatch<ModifierContributionWorkerMessage>;

  constructor(app: ProfessionAppState) {
    this.app = app;
    this.timer = null;
    this.batch = new ManagedWorkerBatch();
    this.requestId = 0;
  }

  schedule(): void {
    const app = this.app;
    const requestId = ++this.requestId;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const failContributions = (): void => {
      if (requestId !== this.requestId || !app.results) return;
      app.results.modifierContributionsStale = false;
      app.adapter.renderResults(app);
    };

    // A new schedule owns a fresh batch, terminating and invalidating any prior pool.
    this.batch.begin(requestId, failContributions);

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
        for (const comparisons of batches) {
          if (!this.batch.isActive(requestId)) break;
          this.batch.spawn(
            // Keep Worker construction beside its static URL so Vite emits an executable worker chunk.
            () => new Worker(new URL('./modifier-contribution-worker.js', import.meta.url), { type: 'module' }),
            requestId,
            {
              requestId,
              request: { ...request, comparisons }
            },
            (data, worker) => {
              this.batch.finish(worker);
              completed.push(data.contributions || []);
              if (completed.length === batches.length) {
                applyContributions(mergeModifierContributions(completed));
              }
            }
          );
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
