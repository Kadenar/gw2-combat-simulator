import type {
  BaselineSimulationOutput,
  BaselineSimulationRequest,
  ProfessionAppState
} from '../types.js';

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

  /** Coalesces rapid edits and keeps at most one expensive worker job in flight. */
  schedule(revision: number): void {
    const requestId = ++this.requestId;
    this.pending = {
      requestId,
      revision,
      request: this.app.adapter.baselineSimulationRequest(this.app)
    };
    this.app.simulationStatus = 'queued';
    this.app.simulationError = '';
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.startPending();
    }, BASELINE_DEBOUNCE_MS);
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

    const worker = this.worker || this.createWorker();
    try {
      worker.postMessage(job);
    } catch (error) {
      worker.terminate();
      if (this.worker === worker) this.worker = null;
      this.finish(job, { requestId: job.requestId, revision: job.revision, error });
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./baseline-simulation-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<BaselineWorkerMessage>) => {
      const job = this.inFlight;
      if (!job || event.data.requestId !== job.requestId) return;
      this.finish(job, event.data);
    });
    worker.addEventListener('error', (event) => {
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
