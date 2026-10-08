import { comparisonKey, type ComparisonResult } from '#gw2/app/page/benchmark-comparison/model.js';
import type { Benchmark } from '#gw2/app/page/benchmarks.js';

export interface ComparisonEntry {
  readonly row: Benchmark;
  status: 'queued' | 'running' | 'complete' | 'error';
  result?: ComparisonResult;
  error?: string;
}

export type RunComparisonBuild = (
  row: Benchmark,
  signal: AbortSignal,
  alliedPlayerCount: number | null
) => Promise<ComparisonResult>;

/** Bound concurrent work, cache successful runs, and reject late publications after cancel or restart. */
export class ComparisonRunner {
  readonly entries = new Map<string, ComparisonEntry>();
  private controller: AbortController | null = null;
  private readonly alliedPlayerCounts = new Map<string, number>();
  constructor(
    private readonly execute: RunComparisonBuild,
    private readonly changed: () => void
  ) {}

  get running(): boolean {
    return this.controller !== null;
  }

  alliedPlayerCount(row: Benchmark): number | null {
    return this.alliedPlayerCounts.get(comparisonKey(row)) ?? null;
  }

  /** Invalidate only the edited simulation; other builds keep their settings and completed results. */
  setAlliedPlayerCount(row: Benchmark, count: number | null): void {
    if (count !== null && (!Number.isInteger(count) || count < 0 || count > 4)) {
      throw new RangeError('Choose between 0 and 4 additional allied players.');
    }

    if (count === this.alliedPlayerCount(row)) return;
    if (this.running) throw new Error('Cancel the current run before changing allies.');
    const key = comparisonKey(row);
    if (count === null) this.alliedPlayerCounts.delete(key);
    else this.alliedPlayerCounts.set(key, count);
    this.entries.delete(key);
    this.changed();
  }

  async run(rows: readonly Benchmark[], force = false): Promise<void> {
    this.cancel();
    const queue = [...new Map(rows.map((row) => [comparisonKey(row), row])).values()].filter(
      (row) => force || this.entries.get(comparisonKey(row))?.status !== 'complete'
    );
    if (!queue.length) return;
    const controller = new AbortController();
    this.controller = controller;
    for (const row of queue) this.entries.set(comparisonKey(row), { row, status: 'queued' });
    this.changed();
    const consume = async (): Promise<void> => {
      while (queue.length && !controller.signal.aborted) {
        const row = queue.shift()!;
        const entry = this.entries.get(comparisonKey(row))!;
        entry.status = 'running';
        this.changed();
        try {
          const result = await this.execute(row, controller.signal, this.alliedPlayerCount(row));
          if (controller.signal.aborted) return;
          entry.result = result;
          entry.status = 'complete';
        } catch (error) {
          if (controller.signal.aborted) return;
          entry.status = 'error';
          entry.error = error instanceof Error ? error.message : String(error);
        }

        this.changed();
      }
    };

    await Promise.all([consume(), consume()]);
    if (this.controller !== controller) return;
    this.controller = null;
    this.changed();
  }

  /** Completed curves survive cancellation; unfinished jobs are removed so a subsequent run can retry them. */
  cancel(): void {
    if (!this.controller) return;
    this.controller.abort();
    this.controller = null;
    for (const [key, entry] of this.entries) {
      if (entry.status === 'queued' || entry.status === 'running') this.entries.delete(key);
    }

    this.changed();
  }
}
