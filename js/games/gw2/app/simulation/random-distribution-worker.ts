import { createGameWorkerEndpoint } from '../../../../app/simulation/game-worker-harness.js';
import type { Gw2AppAdapter, RandomDistributionJobRequest } from '../types.js';

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
 * Calculates one distribution batch through the profession's app adapter.
 *
 * Progress responses have `{ requestId, progress }`. The terminal response has
 * the same request ID and either `distribution` or a string `error`.
 */
createGameWorkerEndpoint<Gw2AppAdapter, RandomDistributionWorkerMessage>({
  calculate(adapter, { includeSamples, request }, postUpdate) {
    const distribution = adapter.calculateRandomDistribution(request, {
      includeSamples: includeSamples === true,
      onProgress(progress) {
        postUpdate({ progress });
      }
    });
    return { distribution };
  }
});
