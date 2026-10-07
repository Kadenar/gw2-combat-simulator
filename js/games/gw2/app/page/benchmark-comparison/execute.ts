import type { RunComparisonBuild } from '#gw2/app/page/benchmark-comparison/runner.js';
import { comparisonKey, type ComparisonResult } from '#gw2/app/page/benchmark-comparison/model.js';

/** Reuse workers across the runner's bounded jobs so engines and prepared builds stay warm between comparisons. */
export function createComparisonExecutor(baseUrl: string): { execute: RunComparisonBuild; dispose: () => void } {
  const idle: Worker[] = [];
  const workers = new Set<Worker>();
  const preparedKeys = new WeakMap<Worker, Set<string>>();
  let nextId = 0;
  const discard = (worker: Worker): void => {
    workers.delete(worker);
    worker.terminate();
  };

  const execute: RunComparisonBuild = (row, signal) => {
    signal.throwIfAborted();
    return new Promise<ComparisonResult>((resolve, reject) => {
      const key = comparisonKey(row);
      // Prefer the worker that already prepared this preset, even if jobs completed in a different order.
      const warmIndex = idle.findIndex((worker) => preparedKeys.get(worker)?.has(key));
      const worker =
        (warmIndex >= 0 ? idle.splice(warmIndex, 1)[0] : idle.pop()) ??
        new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      workers.add(worker);
      const requestId = ++nextId;
      let settled = false;
      const finish = (result?: ComparisonResult, error?: unknown): void => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        worker.removeEventListener('message', message);
        worker.removeEventListener('error', failed);
        worker.removeEventListener('messageerror', unreadable);
        if (result) {
          const keys = preparedKeys.get(worker) ?? new Set<string>();
          keys.add(key);
          preparedKeys.set(worker, keys);
          idle.push(worker);
          resolve(result);
        } else {
          discard(worker);
          reject(error);
        }
      };

      const abort = (): void => finish(undefined, signal.reason);
      const message = ({
        data
      }: MessageEvent<{ requestId: number; result?: ComparisonResult; error?: string }>): void => {
        if (data.requestId !== requestId) return;
        finish(data.result, new Error(data.error ?? 'Simulation returned no result.'));
      };

      const failed = (event: ErrorEvent): void => finish(undefined, new Error(event.message));
      const unreadable = (): void => finish(undefined, new Error('Could not read the simulation result.'));
      signal.addEventListener('abort', abort, { once: true });
      worker.addEventListener('message', message);
      worker.addEventListener('error', failed);
      worker.addEventListener('messageerror', unreadable);
      try {
        // Absolute asset addresses support bundled workers and subdirectory hosting.
        worker.postMessage({
          requestId,
          row: {
            ...row,
            build: new URL(row.build, baseUrl).href,
            rotation: row.rotation ? new URL(row.rotation, baseUrl).href : undefined
          }
        });
      } catch (error) {
        finish(undefined, error);
      }
    });
  };

  return {
    execute,
    dispose: () => {
      for (const worker of workers) worker.terminate();
      workers.clear();
      idle.length = 0;
    }
  };
}
