/** Coalesces baseline execution; lifecycle-bound callbacks own all result publication. */
import { LatestWorkerQueue } from '#browser/game/latest-worker-queue.js';
import type { BaselineOperation } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import type { BaselineSimulationOutput, BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';

interface BaselineWorkerMessage {
  readonly requestId: number;
  readonly output?: BaselineSimulationOutput;
  readonly error?: unknown;
}

export class BaselineSimulationRunner {
  readonly queue: LatestWorkerQueue<BaselineOperation, BaselineWorkerMessage>;
  constructor(calculate: (request: BaselineSimulationRequest) => BaselineSimulationOutput) {
    this.queue = new LatestWorkerQueue<BaselineOperation, BaselineWorkerMessage>({
      debounceMs: 40,
      createWorker: () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
      onStart: (operation) => operation.started(),
      calculateWithoutWorker: (operation) => ({ requestId: operation.requestId, output: calculate(operation.request) }),
      onResult: (operation, message) => {
        if (message.output) operation.complete(message.output);
        else operation.fail(message.error);
      },
      onError: (operation, error) => operation.fail(error)
    });
  }

  /** Warmup loads only the selected engine; it never publishes a baseline. */
  warmup(address: { readonly gameId: string; readonly contentId: string }): void {
    this.queue.warmup({ requestId: 0, warmup: true, request: address });
  }
  run(operation: BaselineOperation): void {
    this.queue.schedule(operation);
  }
  cancel(): void {
    this.queue.cancel();
  }
}
