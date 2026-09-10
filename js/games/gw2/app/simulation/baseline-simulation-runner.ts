import type { BaselineSimulationOutput, BaselineSimulationRequest } from '#gw2/app/simulation/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

interface BaselineJob {
  readonly requestId: number;
  readonly revision: number;
  readonly request: BaselineSimulationRequest;
}

interface BaselineWorkerMessage {
  readonly requestId: number;
  readonly revision: number;
  readonly output?: BaselineSimulationOutput;
  readonly error?: unknown;
}

const BASELINE_DEBOUNCE_MS = 40;

export class BaselineSimulationRunner {
  readonly app: ProfessionAppState;
  timer: ReturnType<typeof setTimeout> | null;
  worker: Worker | null;
  pending: BaselineJob | null;
  inFlight: BaselineJob | null;
  requestId: number;

  constructor(app: ProfessionAppState) {
    this.app = app;
    this.timer = null;
    this.worker = null;
    this.pending = null;
    this.inFlight = null;
    this.requestId = 0;
  }

  /** Load the selected profession while the page is opening, before a template click needs its first result. */
  warmup(): void {
    if (this.worker || typeof Worker !== 'function') return;
    let worker: Worker | null = null;
    try {
      worker = this.createWorker();
      worker.postMessage({
        requestId: 0,
        revision: -1,
        warmup: true,
        request: { gameId: this.app.gameId, contentId: this.app.contentId }
      });
    } catch {
      // Warmup is optional; an actual simulation retries construction through the normal error path.
      worker?.terminate();
      this.worker = null;
    }
  }

  /** Coalesces rapid edits and keeps at most one expensive worker job in flight. */
  schedule(revision: number): void {
    const request = this.app.adapter.baselineSimulationRequest(this.app);
    // Clearing abandons the old rotation; subsequent skills must not queue behind its simulation or cold load.
    if (this.inFlight && request.rotation.length === 0) this.cancel();
    const requestId = ++this.requestId;
    this.pending = {
      requestId,
      revision,
      request
    };
    this.app.simulationStatus = 'queued';
    this.app.simulationError = '';
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.startPending();
    }, BASELINE_DEBOUNCE_MS);
  }

  /** Cancel active work, retaining an idle worker so changing templates does not reload the same engine. */
  cancel(): void {
    this.requestId += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    if (this.inFlight) {
      this.worker?.terminate();
      this.worker = null;
    }

    this.inFlight = null;
  }

  private startPending(): void {
    if (this.inFlight || !this.pending) return;
    const job = this.pending;
    this.pending = null;
    this.inFlight = job;
    if (job.requestId === this.requestId) this.app.simulationStatus = 'running';

    if (typeof Worker !== 'function') {
      // Tests and older browsers retain correctness; the timeout still separates mutation from calculation.
      setTimeout(() => {
        // Superseded fallback jobs must release the slot so the newest pending edit can run.
        if (job.requestId !== this.requestId)
          return this.finish(job, { requestId: job.requestId, revision: job.revision });
        try {
          this.finish(job, {
            requestId: job.requestId,
            revision: job.revision,
            output: this.app.adapter.calculateBaselineSimulation(job.request)
          });
        } catch (error) {
          this.finish(job, { requestId: job.requestId, revision: job.revision, error });
        }
      }, 0);
      return;
    }

    let worker = this.worker;
    try {
      // Worker construction can be blocked by browser policy; failures use the same cleanup path as postMessage errors.
      worker ||= this.createWorker();
      worker.postMessage(job);
    } catch (error) {
      worker?.terminate();
      if (this.worker === worker) this.worker = null;
      this.finish(job, { requestId: job.requestId, revision: job.revision, error });
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./baseline-simulation-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<BaselineWorkerMessage>) => {
      if (this.worker !== worker) return;
      const job = this.inFlight;
      if (!job || event.data.requestId !== job.requestId) return;
      this.finish(job, event.data);
    });
    worker.addEventListener('error', (event) => {
      // Queued events from an abandoned worker cannot fail the replacement job.
      if (this.worker !== worker) return;
      const job = this.inFlight;
      worker.terminate();
      if (this.worker === worker) this.worker = null;
      if (job)
        this.finish(job, { requestId: job.requestId, revision: job.revision, error: event.error ?? event.message });
    });
    this.worker = worker;
    return worker;
  }

  private finish(job: BaselineJob, message: BaselineWorkerMessage): void {
    if (this.inFlight?.requestId !== job.requestId) return;
    this.inFlight = null;
    if (job.requestId === this.requestId && job.revision === this.app.buildRevision) {
      if (message.output) this.app.publishBaselineSimulation(message.output, job.revision);
      else this.app.failBaselineSimulation(message.error, job.revision);
    }

    // A newer edit replaces every intermediate request and starts as soon as the worker is free.
    if (this.pending) this.startPending();
  }
}
