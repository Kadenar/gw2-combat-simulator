interface WorkerMessage {
  readonly requestId: number;
  readonly error?: unknown;
}

type QueuedJob<TJob> = TJob & { readonly requestId: number };

interface LatestWorkerQueueOptions<TJob, TMessage extends WorkerMessage> {
  readonly debounceMs: number;
  readonly createWorker: () => Worker;
  readonly onStart?: (job: QueuedJob<TJob>) => void;
  readonly onResult: (job: QueuedJob<TJob>, message: TMessage) => void;
  readonly onError: (job: QueuedJob<TJob>, error: unknown) => void;
  readonly calculateWithoutWorker?: (job: QueuedJob<TJob>) => TMessage;
}

/** Coalesces edits onto one warm worker; only the latest request may publish, and cancellation abandons active work. */
export class LatestWorkerQueue<TJob extends { readonly request: unknown }, TMessage extends WorkerMessage> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private worker: Worker | null = null;
  private requestId = 0;
  private queued: QueuedJob<TJob> | null = null;
  private active: QueuedJob<TJob> | null = null;

  constructor(private readonly options: LatestWorkerQueueOptions<TJob, TMessage>) {}

  get pending(): QueuedJob<TJob> | null {
    return this.queued;
  }
  get inFlight(): QueuedJob<TJob> | null {
    return this.active;
  }
  get isRunning(): boolean {
    return this.queued !== null || this.active !== null;
  }

  schedule(job: TJob): void {
    this.queued = { ...job, requestId: ++this.requestId };

    if (this.timer !== null) clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      this.timer = null;
      this.startPending();
    }, this.options.debounceMs);
  }

  /** Optional preload messages never publish job results or prevent a later construction retry. */
  warmup(message: unknown): void {
    if (this.worker || typeof Worker !== 'function') return;

    try {
      this.createWorker().postMessage(message);
    } catch {
      this.terminateWorker();
    }
  }

  cancel(): void {
    this.requestId++;

    if (this.timer !== null) clearTimeout(this.timer);

    this.timer = null;
    this.queued = null;

    // An idle worker keeps its loaded engine; active synchronous work must be terminated.
    if (this.active) {
      this.terminateWorker();
    }

    this.active = null;
  }

  private startPending(): void {
    if (this.active || !this.queued) return;

    const job = this.queued;
    this.queued = null;
    this.active = job;
    this.options.onStart?.(job);

    // Owners may supply a local calculation when the host has no Worker implementation.
    if (typeof Worker !== 'function' && this.options.calculateWithoutWorker) {
      setTimeout(() => {
        if (job.requestId !== this.requestId) return this.finish(job);

        try {
          this.finish(job, this.options.calculateWithoutWorker!(job));
        } catch (error) {
          this.finish(job, undefined, error);
        }
      }, 0);
      return;
    }

    try {
      const worker = this.worker ?? this.createWorker();
      worker.postMessage({ requestId: job.requestId, request: job.request });
    } catch (error) {
      this.terminateWorker();
      this.finish(job, undefined, error);
    }
  }

  private createWorker(): Worker {
    const worker = this.options.createWorker();
    this.worker = worker;
    worker.addEventListener('message', (event: MessageEvent<TMessage>) => {
      const job = this.active;

      if (this.worker !== worker || !job || event.data.requestId !== job.requestId) return;

      this.finish(job, event.data);
    });
    worker.addEventListener('error', (event) => {
      if (this.worker !== worker) return;

      const job = this.active;
      worker.terminate();
      this.worker = null;

      if (job)
        this.finish(
          job,
          undefined,
          event.error ?? (event.message || 'Worker failed to load or run. Reload the page and try again.')
        );
    });
    return worker;
  }

  private terminateWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private finish(job: QueuedJob<TJob>, message?: TMessage, error?: unknown): void {
    if (this.active !== job) return;

    this.active = null;
    // Edits queued behind this job start when it finishes; callback follow-ups retain their own debounce.
    const superseded = this.queued !== null;

    if (job.requestId === this.requestId) {
      if (message && message.error === undefined) this.options.onResult(job, message);
      else this.options.onError(job, message?.error ?? error);
    }

    if (superseded) this.startPending();
  }
}
