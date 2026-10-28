import { LatestWorkerQueue } from '#browser/game/latest-worker-queue.js';
import { analysisViewIsActive } from '#browser/shell/result-view.js';
import type { BaselineSimulationOutput, BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

interface BaselineJob {
  readonly revision: number;
  readonly request: BaselineSimulationRequest;
  readonly chartsOnly: boolean;
}

interface BaselineWorkerMessage {
  readonly requestId: number;
  readonly output?: BaselineSimulationOutput;
  readonly error?: unknown;
}

const BASELINE_DEBOUNCE_MS = 40;

/** Owns revision and chart-publication policy while the shared queue manages worker lifetime. */
export class BaselineSimulationRunner {
  readonly queue: LatestWorkerQueue<BaselineJob, BaselineWorkerMessage>;

  constructor(readonly app: ProfessionAppState) {
    this.queue = new LatestWorkerQueue<BaselineJob, BaselineWorkerMessage>({
      debounceMs: BASELINE_DEBOUNCE_MS,
      // Static worker URLs must remain beside construction for Vite's module-worker bundling.
      createWorker: () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
      onStart: () => {
        app.simulationStatus = 'running';
      },
      calculateWithoutWorker: (job) => ({
        requestId: job.requestId,
        output: app.adapter.calculateBaselineSimulation(job.request)
      }),
      onResult: (job, message) => {
        if (job.revision !== app.buildRevision) return;

        if (message.output) app.publishBaselineSimulation(message.output, job.revision, job.chartsOnly);
        else app.failBaselineSimulation(message.error, job.revision, job.chartsOnly);

        // Analysis may have opened while an editor-only baseline was already in flight.
        if (message.output && !job.chartsOnly) this.ensureCharts();
      },
      onError: (job, error) => {
        if (job.revision === app.buildRevision) app.failBaselineSimulation(error, job.revision, job.chartsOnly);
      }
    });
  }

  /** Load the selected profession while the page is opening, before a template click needs its first result. */
  warmup(): void {
    this.queue.warmup({
      requestId: 0,
      warmup: true,
      request: { gameId: this.app.gameId, contentId: this.app.contentId }
    });
  }

  /** Coalesces rapid edits and gives editor work priority over chart enrichment. */
  schedule(revision: number, chartsOnly = false): void {
    if (!chartsOnly && (this.queue.inFlight?.chartsOnly || this.queue.pending?.chartsOnly)) this.cancel();

    const request = this.app.adapter.baselineSimulationRequest(this.app);

    // Clearing abandons the old rotation instead of queueing behind its simulation or cold load.
    if (this.queue.inFlight && request.rotation.length === 0) this.cancel();

    this.app.simulationStatus = 'queued';
    this.app.simulationError = '';
    this.queue.schedule({
      revision,
      request: chartsOnly ? { ...request, collectChartData: true } : request,
      chartsOnly
    });
  }

  /** Enrich a current editor result once on Analysis entry; reuse cached histories on subsequent visits. */
  ensureCharts(): void {
    if (
      !analysisViewIsActive() ||
      this.queue.isRunning ||
      !this.app.results ||
      !this.app.build.rotation.length ||
      this.app.resultRevision !== this.app.buildRevision ||
      this.app.results.effectReport
    )
      return;

    this.schedule(this.app.buildRevision, true);
  }

  /** Leaving Analysis abandons only chart work; an ordinary editor baseline must still finish. */
  cancelCharts(): void {
    if (!this.queue.inFlight?.chartsOnly && !this.queue.pending?.chartsOnly) return;

    this.cancel();
    this.app.simulationStatus = this.app.resultRevision === this.app.buildRevision ? 'idle' : 'queued';

    if (typeof document !== 'undefined' && document.body)
      document.body.dataset.simulationStatus = this.app.simulationStatus;
  }

  cancel(): void {
    this.queue.cancel();
  }
}
