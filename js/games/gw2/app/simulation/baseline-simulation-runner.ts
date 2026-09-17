import type { BaselineSimulationCalculation, SelectedBaselineSimulationRequest } from '#gw2/app/simulation/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

interface BaselineJob {
  readonly requestId: number;
  readonly revision: number;
  readonly request: SelectedBaselineSimulationRequest;
  readonly identity: string;
}

interface BaselineWorkerMessage {
  readonly requestId: number;
  readonly revision: number;
  readonly output?: BaselineSimulationCalculation;
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
    let request: SelectedBaselineSimulationRequest;
    try {
      request = this.app.adapter.baselineSimulationRequest(this.app);
    } catch (error) {
      this.cancel();
      this.app.failBaselineSimulation(error, revision);
      return;
    }

    // Clearing abandons the old rotation; subsequent skills must not queue behind its simulation or cold load.
    if (this.inFlight && request.rotation.length === 0) this.cancel();
    const requestId = ++this.requestId;
    this.pending = {
      requestId,
      revision,
      request,
      identity: this.identity()
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
  cancel(terminateIdle = false): void {
    this.requestId += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    if (this.inFlight || terminateIdle) {
      this.worker?.terminate();
      this.worker = null;
    }

    this.inFlight = null;
  }

  private startPending(): void {
    // A preview tick loop cannot process queued cancellation; replace it after edits settle.
    if (
      this.inFlight &&
      this.pending &&
      (this.inFlight.request.selection?.engine === 'preview' ||
        this.pending.request.selection?.engine === 'preview' ||
        this.inFlight.identity !== this.pending.identity)
    ) {
      this.worker?.terminate();
      this.worker = null;
      this.inFlight = null;
    }

    if (this.inFlight || !this.pending) return;
    const job = this.pending;
    this.pending = null;
    this.inFlight = job;
    if (job.requestId === this.requestId) this.app.simulationStatus = 'running';

    if (typeof Worker !== 'function') {
      if (job.request.selection?.engine === 'preview') {
        this.finish(job, {
          requestId: job.requestId,
          revision: job.revision,
          error: 'New engine preview requires Web Workers. Select Legacy to continue.'
        });
        return;
      }

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
      if (!job || event.data.requestId !== job.requestId || event.data.revision !== job.revision) return;
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
    if (
      job.requestId === this.requestId &&
      job.revision === this.app.buildRevision &&
      job.identity === this.identity()
    ) {
      const output = message.output;
      if (job.request.selection?.engine === 'preview') {
        if (!output || !('ok' in output))
          this.app.failBaselineSimulation(message.error ?? 'Preview worker returned no preview result.', job.revision);
        else if (!output.ok) this.app.failBaselineSimulation(output.message, job.revision);
        else if (
          output.output !== 'detailed' ||
          output.identity.engine !== 'gw2.combat-engine' ||
          output.identity.mode !== 'detailed' ||
          output.identity.contentRevision !== job.request.selection.contentRevision ||
          output.identity.seed !== (('seed' in job.request ? job.request.seed : 1) ?? 1)
        )
          this.app.failBaselineSimulation('Preview worker returned mismatched simulation identity.', job.revision);
        else this.app.publishBaselineSimulation({ result: output.result, patchComparison: null }, job.revision);
      } else if (output && !('ok' in output)) this.app.publishBaselineSimulation(output, job.revision);
      else this.app.failBaselineSimulation(message.error ?? 'Legacy worker returned an invalid result.', job.revision);
    }

    // A newer edit replaces every intermediate request and starts as soon as the worker is free.
    if (this.pending) this.startPending();
  }

  /** Revisions cover inputs; this also rejects late results after tab or engine selection changes. */
  private identity(): string {
    return JSON.stringify([
      this.app.workspace?.activeTabId,
      this.app.previewSelection ?? null,
      this.app.patchId,
      this.app.build?.assumptions?.simulationMode
    ]);
  }
}
