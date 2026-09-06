import { ManagedWorkerBatch, type GameWorkerResponseEnvelope } from '#app/simulation/game-worker-harness.js';
import {
  retainOptimizerCandidate,
  type GearOptimizerRequest,
  type OptimizerCandidate,
  type OptimizerScore
} from '#gw2/app/simulation/gear-optimizer.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export const MAX_OPTIMIZER_WORKERS = 4;

interface OptimizerMessage extends GameWorkerResponseEnvelope {
  readonly kind: 'ready' | 'chunk' | 'verified';
  readonly count?: string;
  readonly rawCount?: string;
  readonly baseline?: OptimizerScore;
  readonly chunkId?: number;
  readonly represented?: string;
  readonly simulations?: string;
  readonly winners?: OptimizerCandidate[];
  readonly warnings?: [string, number][];
  readonly elapsedMs?: number;
}

export interface OptimizerProgress {
  status: 'idle' | 'preparing' | 'running' | 'verifying' | 'complete' | 'canceled' | 'failed';
  error: string;
  rawCount: bigint;
  count: bigint;
  completed: bigint;
  represented: bigint;
  simulations: bigint;
  baseline: OptimizerScore | null;
  winners: OptimizerCandidate[];
  warnings: Map<string, bigint>;
  started: number;
  elapsedMs: number;
}

/** Persistent workers pull disjoint unique-combination ranges; failure and cancellation terminate synchronous simulations immediately. */
export class GearOptimizerRunner {
  readonly batch = new ManagedWorkerBatch<OptimizerMessage>();
  request: GearOptimizerRequest | null = null;
  private requestId = 0;
  private lastPublished = 0;
  state: OptimizerProgress = this.emptyState();

  constructor(
    readonly app: Pick<ProfessionAppState, 'buildRevision'>,
    readonly onUpdate: () => void = () => {},
    private readonly createWorker = () =>
      new Worker(new URL('./gear-optimizer-worker.js', import.meta.url), { type: 'module' }),
    // Each worker owns simulation state; keep concurrency conservative to avoid multiplying peak memory.
    readonly workerCount = Math.min(2, Math.max(1, (globalThis.navigator?.hardwareConcurrency || 2) - 1))
  ) {}

  private emptyState(): OptimizerProgress {
    return {
      status: 'idle',
      error: '',
      rawCount: 0n,
      count: 0n,
      completed: 0n,
      represented: 0n,
      simulations: 0n,
      baseline: null,
      winners: [],
      warnings: new Map(),
      started: performance.now(),
      elapsedMs: 0
    };
  }

  get isRunning(): boolean {
    return this.batch.isRunning;
  }

  cancel(): void {
    ++this.requestId;
    this.batch.terminateAll();
    if (['preparing', 'running', 'verifying'].includes(this.state.status)) this.state.status = 'canceled';
    this.publish(true);
  }

  private publish(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastPublished < 150) return;
    this.lastPublished = now;
    this.state.elapsedMs = now - this.state.started;
    this.onUpdate();
  }

  run(request: GearOptimizerRequest, workerCount = this.workerCount): void {
    // Validate before replacing an active job; workers are bounded independently of the candidate search space.
    if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > MAX_OPTIMIZER_WORKERS)
      throw new RangeError(`Choose between 1 and ${MAX_OPTIMIZER_WORKERS} workers.`);
    this.cancel();
    const requestId = ++this.requestId;
    this.request = request;
    this.state = this.emptyState();
    this.state.status = 'preparing';
    let next = 0n;
    let chunkId = 0;
    let bootstrapped = false;
    let chunkSize = 1n;
    const pending = new Map<Worker, { id: number; size: bigint }>();
    const ready = new Set<Worker>();
    const fail = (error: unknown): void => {
      this.state.status = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
      this.batch.terminateAll();
      this.publish(true);
    };

    this.batch.begin(requestId, fail);
    const dispatch = (worker: Worker): void => {
      if (!this.batch.isActive(requestId)) return;
      if (next >= this.state.count) return;
      const end = next + chunkSize < this.state.count ? next + chunkSize : this.state.count;
      const id = ++chunkId;
      pending.set(worker, { id, size: end - next });
      worker.postMessage({ kind: 'chunk', requestId, chunkId: id, start: next.toString(), end: end.toString() });
      next = end;
    };

    const receive = (message: OptimizerMessage, worker: Worker): void => {
      if (this.app.buildRevision !== request.revision) {
        this.cancel();
        return;
      }

      if (message.kind === 'ready') {
        if (ready.has(worker)) throw new Error('Duplicate optimizer readiness.');
        ready.add(worker);
        if (!bootstrapped) {
          bootstrapped = true;
          this.state.count = BigInt(message.count!);
          this.state.rawCount = BigInt(message.rawCount!);
          this.state.baseline = message.baseline!;
          this.state.status = 'running';
          const workers = Number(this.state.count < BigInt(workerCount) ? this.state.count : BigInt(workerCount));
          for (let index = 1; index < workers; index++) spawn();
        } else if (BigInt(message.count!) !== this.state.count || BigInt(message.rawCount!) !== this.state.rawCount) {
          throw new Error('Optimizer workers disagree on the search space.');
        }

        dispatch(worker);
      } else if (message.kind === 'chunk') {
        const chunk = pending.get(worker);
        if (!chunk || chunk.id !== message.chunkId) throw new Error('Unexpected optimizer chunk completion.');
        // Every dispatched ordinal is unique across the pool and must produce exactly one search simulation.
        if (BigInt(message.simulations!) !== chunk.size)
          throw new Error('Optimizer did not evaluate each unique candidate once.');
        pending.delete(worker);
        this.state.completed += chunk.size;
        this.state.represented += BigInt(message.represented!);
        this.state.simulations += BigInt(message.simulations!);
        for (const candidate of message.winners || [])
          retainOptimizerCandidate(this.state.winners, candidate, request.limit);
        for (const [warning, count] of message.warnings || []) {
          const category =
            this.state.warnings.has(warning) || this.state.warnings.size < 32
              ? warning
              : 'Additional warning categories';
          this.state.warnings.set(category, (this.state.warnings.get(category) || 0n) + BigInt(count));
        }

        // Target about 150 ms per chunk, capped to bound message and cancellation bookkeeping.
        chunkSize = BigInt(
          Math.max(1, Math.min(256, Math.round((Number(chunk.size) * 150) / Math.max(1, message.elapsedMs || 1))))
        );
        dispatch(worker);
        if (this.state.completed === this.state.count && !pending.size) {
          if (this.state.represented !== this.state.rawCount)
            throw new Error('Optimizer coverage does not match the legal search space.');
          this.state.status = 'verifying';
          worker.postMessage({ kind: 'verify', requestId, candidates: this.state.winners });
          this.publish(true);
        }
      } else if (message.kind === 'verified') {
        if (this.state.status !== 'verifying') throw new Error('Unexpected optimizer verification.');
        this.state.status = 'complete';
        this.batch.terminateAll();
        this.publish(true);
        return;
      }

      this.publish();
    };

    const spawn = (): void => {
      this.batch.spawn(this.createWorker, requestId, { kind: 'init', requestId, request }, receive);
    };

    if (this.app.buildRevision !== request.revision) {
      fail('Optimizer request is stale.');
      return;
    }

    spawn();
    this.publish(true);
  }
}
