/** Debounces and partitions modifier execution without owning application result state. */
import { ManagedWorkerBatch, type GameWorkerResponseEnvelope } from '#browser/game/managed-worker-batch.js';
import type { ModifierOperation } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import {
  mergeModifierContributions,
  modifierContributionWorkerCount,
  partitionModifierComparisons
} from '#gw2/app/simulation/modifier-contributions/modifier-contributions.js';
import type {
  ModifierContribution,
  ModifierContributionBatchRequest,
  ModifierContributionBatchResult,
  ModifierContributionRequest
} from '#gw2/app/simulation/modifier-contributions/types.js';

type ModifierContributionWorkerMessage = GameWorkerResponseEnvelope & ModifierContributionBatchResult;

export class ModifierContributionRunner {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private readonly batch = new ManagedWorkerBatch<ModifierContributionWorkerMessage>();
  constructor(private readonly calculate: (request: ModifierContributionRequest) => ModifierContribution[]) {}
  cancel(): void {
    ++this.requestId;

    if (this.timer !== null) clearTimeout(this.timer);

    this.timer = null;
    this.batch.terminateAll();
  }
  run(operation: ModifierOperation): void {
    this.cancel();
    const requestId = ++this.requestId;
    const { request } = operation;
    const failContributions = (error: unknown) => {
      if (requestId === this.requestId) operation.fail(error);
    };

    const applyContributions = (contributions: ModifierContribution[]) => {
      if (requestId === this.requestId) operation.complete(contributions);
    };

    this.batch.begin(requestId, failContributions);
    const calculateContributions = (): void => {
      this.timer = null;

      if (requestId !== this.requestId) return;

      if (!operation.ready()) {
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

        const completed: ModifierContributionBatchResult[] = [];
        let completedCount = 0;
        for (const [index, comparisons] of batches.entries()) {
          if (!this.batch.isActive(requestId)) break;

          this.batch.spawn(
            // Keep Worker construction beside its static URL so Vite emits an executable worker chunk.
            () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
            requestId,
            {
              requestId,
              // Omission workers do not receive baseline configuration or recompute its score.
              request: {
                gameId: request.gameId,
                contentId: request.contentId,
                rotation: request.rotation,
                comparisons
              } satisfies ModifierContributionBatchRequest
            },
            (data, worker) => {
              this.batch.finish(worker);
              // Preserve partition order when workers finish in a different order.
              completed[index] = data;
              completedCount += 1;

              if (completedCount === batches.length) {
                applyContributions(mergeModifierContributions(request.baselineDps, completed));
              }
            }
          );
        }

        return;
      }

      try {
        applyContributions(this.calculate(request));
      } catch (error) {
        failContributions(error);
      }
    };

    this.timer = setTimeout(calculateContributions, 750);
  }
}
