import { LatestWorkerQueue } from '#browser/game/latest-worker-queue.js';
import type { GameWorkerResponseEnvelope } from '#browser/game/worker-harness.js';
import type { RelicComparisonModel } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { RelicComparisonWorkerRequest } from '#gw2/app/optimizer/relic-comparison/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

interface RelicComparisonWorkerMessage extends GameWorkerResponseEnvelope {
  readonly comparison: RelicComparisonModel;
}

interface RelicComparisonJob {
  readonly request: RelicComparisonWorkerRequest;
  readonly results: NonNullable<ProfessionAppState['results']>;
  readonly revision: number;
}

/** Runs one user-selected relic simulation against the equipped relic already on screen. */
export class RelicComparisonRunner {
  readonly app: ProfessionAppState;
  private readonly queue: LatestWorkerQueue<RelicComparisonJob, RelicComparisonWorkerMessage>;
  comparisonRelic: string;
  initialStacks: number;
  readonly onUpdate: () => void;

  constructor(app: ProfessionAppState, onUpdate: () => void = () => {}) {
    this.app = app;
    this.comparisonRelic = '';
    this.initialStacks = 0;
    // Let the owning relic panel refresh without rerendering unrelated simulation views.
    this.onUpdate = onUpdate;
    // Completed comparisons retain their loaded profession; abandoned calculations release the occupied worker.
    const isCurrent = (job: RelicComparisonJob) => app.results === job.results && app.buildRevision === job.revision;
    this.queue = new LatestWorkerQueue({
      debounceMs: 0,
      createWorker: () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
      onResult: (job, message) => {
        if (!isCurrent(job)) return;

        job.results.relicComparison = message.comparison;
        job.results.relicComparisonStale = false;
        job.results.relicComparisonError = '';
        this.onUpdate();
      },
      onError: (job, error) => {
        if (!isCurrent(job)) return;

        job.results.relicComparisonStale = false;
        job.results.relicComparisonError =
          error instanceof Error ? error.message : String(error || 'Relic comparison failed.');
        this.onUpdate();
      }
    });
  }

  /** Keeps a valid selection, preferring Thorns as the initial comparison when available. */
  selectedComparisonRelic(requested = this.comparisonRelic): string {
    const alternatives = this.app.relicNames.filter((name) => name !== this.app.build.relic);
    return alternatives.includes(requested)
      ? requested
      : alternatives.includes('Thorns')
        ? 'Thorns'
        : (alternatives[0] ?? '');
  }

  /** Terminates comparison work when the owning tab or result is abandoned. */
  cancel(): void {
    this.queue.cancel();
  }

  /** Publishes picker availability without paying for another simulation. */
  schedule(): void {
    const app = this.app;
    this.cancel();

    const results = app.results;

    if (!results) return;

    this.comparisonRelic = this.selectedComparisonRelic();
    const request = app.build.rotation.length ? app.adapter.relicComparisonRequest(app, this.comparisonRelic) : null;

    if (!request) {
      results.relicComparisonAvailable = false;
      results.relicComparisonStale = false;
      results.relicComparisonError = '';
      results.relicComparison = undefined;
      results.relicComparisonOpponent = '';
      results.relicComparisonTarget = '';
      return;
    }

    results.relicComparisonAvailable = true;
    results.relicComparisonInitialStacks = this.initialStacks;
    results.relicComparisonStale = false;
    results.relicComparisonError = '';

    if (
      results.relicComparison &&
      (results.relicComparison.opponentRelic !== request.opponentRelic ||
        results.relicComparison.targetRelic !== request.comparisonRelic)
    ) {
      results.relicComparison = undefined;
    }

    results.relicComparisonOpponent = request.opponentRelic;
    results.relicComparisonTarget = request.comparisonRelic;
  }

  /** Applies each relic's configured assumptions to its comparison simulation. */
  run(comparisonRelic: string = this.comparisonRelic, initialStacks: number = this.initialStacks): void {
    const app = this.app;
    this.cancel();

    const results = app.results;

    if (!results) return;

    this.comparisonRelic = this.selectedComparisonRelic(String(comparisonRelic || ''));
    this.initialStacks = Math.min(10, Math.max(0, Math.trunc(Number(initialStacks) || 0)));
    results.relicComparisonInitialStacks = this.initialStacks;
    const request = app.build.rotation.length ? app.adapter.relicComparisonRequest(app, this.comparisonRelic) : null;

    if (!request) {
      this.schedule();
      this.onUpdate();
      return;
    }

    results.relicComparisonAvailable = true;
    results.relicComparisonStale = true;
    results.relicComparisonError = '';
    results.relicComparisonOpponent = request.opponentRelic;
    results.relicComparisonTarget = request.comparisonRelic;
    this.onUpdate();

    // Send only the baseline facts used by damage comparison, excluding chart histories and other analysis results.
    const workerRequest: RelicComparisonWorkerRequest = {
      ...request,
      opponentResult: {
        dps: results.dps,
        breakdown: results.breakdown,
        resolvedEvents: results.resolvedEvents,
        dpsStartTime: results.dpsStartTime,
        firstHitTime: results.firstHitTime,
        combatEndTime: results.combatEndTime
      },
      initialStacks: this.initialStacks
    };
    this.queue.schedule({ request: workerRequest, results, revision: app.buildRevision });
  }
}
