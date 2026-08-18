import { loadProfessionAppAdapter } from '../profession/registry.js';
import type { RandomDistributionJobRequest } from '../profession/types.js';

/**
 * The single request message this worker accepts. Cancellation and
 * stale-response handling are owned by the application shell, which terminates
 * the worker when the request is superseded.
 */
interface RandomDistributionWorkerMessage {
  readonly requestId: number;
  readonly request: RandomDistributionJobRequest;
  readonly includeSamples?: boolean;
}

/**
 * Minimal dedicated-worker scope. The default DOM lib types `self` as a
 * `Window`, whose `postMessage` requires a target origin; a worker's does not.
 */
interface DedicatedWorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<RandomDistributionWorkerMessage>) => void): void;
  postMessage(message: unknown): void;
}

const workerScope = self as unknown as DedicatedWorkerScope;

/**
 * Calculates one distribution batch through the profession's app adapter.
 *
 * Progress responses have `{ requestId, progress }`. The terminal response has
 * the same request ID and either `distribution` or a string `error`.
 */
workerScope.addEventListener('message', async ({ data }) => {
  const { requestId, request } = data;
  try {
    const adapter = await loadProfessionAppAdapter(request.professionId);
    if (!adapter) {
      throw new Error(`No application adapter for ${request.professionId}.`);
    }
    const distribution = adapter.calculateRandomDistribution(request, {
      includeSamples: data.includeSamples === true,
      onProgress(progress) {
        workerScope.postMessage({ requestId, progress });
      }
    });
    workerScope.postMessage({ requestId, distribution });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
