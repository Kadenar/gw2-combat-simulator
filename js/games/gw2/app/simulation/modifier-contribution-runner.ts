import {
  mergeModifierContributions,
  modifierContributionWorkerCount,
  partitionModifierComparisons
} from '#gw2/app/simulation/modifier-contributions.js';
import { ManagedWorkerBatch, type GameWorkerResponseEnvelope } from '#app/simulation/game-worker-harness.js';
import type { ModifierContribution } from '#gw2/app/simulation/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

const MODIFIER_CONTRIBUTION_DEBOUNCE_MS = 750;

interface ModifierContributionWorkerMessage extends GameWorkerResponseEnvelope {
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

  /** Stops work owned by the outgoing tab before another result becomes active. */
  cancel(): void {
    this.requestId += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.batch.terminateAll();
  }

  schedule(): void {
    const app = this.app;
    const requestId = ++this.requestId;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const failContributions = (error: unknown): void => {
      if (requestId !== this.requestId || !app.results) return;
      // Failed comparisons must not make carried values from the prior build look current.
      app.results.contributions = undefined;
      app.results.modifierContributionsStale = false;
      app.results.modifierContributionsError =
        error instanceof Error ? error.message : String(error || 'Modifier contribution calculation failed.');
      app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));
    };

    // A new schedule owns a fresh batch, terminating and invalidating any prior pool.
    this.batch.begin(requestId, failContributions);

    if (!app.build.rotation.length || !app.results) {
      if (app.results) {
        app.results.modifierContributionsStale = false;
        app.results.modifierContributionsError = '';
      }

      return;
    }

    app.results.modifierContributionsStale = true;
    app.results.modifierContributionsError = '';
    const request = app.adapter.modifierContributionRequest(app);
    const applyContributions = (contributions: ModifierContribution[]): void => {
      if (requestId !== this.requestId || !app.results) return;
      app.results.contributions = contributions;
      app.results.modifierContributionsStale = false;
      app.results.modifierContributionsError = '';
      app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));
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
      } catch (error) {
        failContributions(error);
      }
    };

    this.timer = setTimeout(calculateContributions, MODIFIER_CONTRIBUTION_DEBOUNCE_MS);
  }
}
