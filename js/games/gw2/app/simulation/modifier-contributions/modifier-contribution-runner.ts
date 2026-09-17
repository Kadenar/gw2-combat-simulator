import {
  mergeModifierContributions,
  modifierContributionWorkerCount,
  partitionModifierComparisons
} from '#gw2/app/simulation/modifier-contributions/modifier-contributions.js';
import { ManagedWorkerBatch, type GameWorkerResponseEnvelope } from '#app/simulation/game-worker-harness.js';
import { analysisViewIsActive } from '#app/shell/result-view.js';
import type {
  ModifierContribution,
  ModifierContributionRequest
} from '#gw2/app/simulation/modifier-contributions/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

const MODIFIER_CONTRIBUTION_DEBOUNCE_MS = 750;

interface ModifierContributionWorkerMessage extends GameWorkerResponseEnvelope {
  readonly contributions?: ModifierContribution[];
}

export class ModifierContributionRunner {
  readonly app: ProfessionAppState;
  timer: ReturnType<typeof setTimeout> | null;
  requestId: number;
  isRunning = false;
  private readonly batch: ManagedWorkerBatch<ModifierContributionWorkerMessage>;
  readonly onUpdate: () => void;

  constructor(app: ProfessionAppState, onUpdate: () => void = () => {}) {
    this.app = app;
    this.timer = null;
    this.batch = new ManagedWorkerBatch();
    this.requestId = 0;
    this.onUpdate = onUpdate;
  }

  /** Stops work owned by the outgoing tab before another result becomes active. */
  cancel(): void {
    this.requestId += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.batch.terminateAll();
    this.isRunning = false;
  }

  schedule(): void {
    const app = this.app;
    // Only missing or stale comparisons for the current baseline consume workers while Analysis is visible.
    if (
      this.isRunning ||
      !analysisViewIsActive() ||
      !app.build.rotation.length ||
      !app.results ||
      app.resultRevision !== app.buildRevision ||
      (Array.isArray(app.results.contributions) && !app.results.modifierContributionsStale)
    )
      return;
    this.isRunning = true;
    const requestId = ++this.requestId;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const failContributions = (error: unknown): void => {
      if (requestId !== this.requestId || !app.results) return;
      this.isRunning = false;
      // Failed comparisons must not make carried values from the prior build look current.
      app.results.contributions = undefined;
      app.results.modifierContributionsStale = false;
      app.results.modifierContributionsError =
        error instanceof Error ? error.message : String(error || 'Modifier contribution calculation failed.');
      this.onUpdate();
    };

    // A new schedule owns a fresh batch, terminating and invalidating any prior pool.
    this.batch.begin(requestId, failContributions);

    app.results.modifierContributionsStale = true;
    app.results.modifierContributionsError = '';
    this.onUpdate();
    let request: ModifierContributionRequest;
    try {
      request = app.adapter.modifierContributionRequest(app);
    } catch (error) {
      failContributions(error);

      return;
    }

    const applyContributions = (contributions: ModifierContribution[]): void => {
      if (requestId !== this.requestId || !app.results) return;
      this.isRunning = false;
      app.results.contributions = contributions;
      app.results.modifierContributionsStale = false;
      app.results.modifierContributionsError = '';
      this.onUpdate();
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
