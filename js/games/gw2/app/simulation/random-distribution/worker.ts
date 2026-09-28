import { createGameWorkerEndpoint } from '#browser/game/worker-harness.js';
import { calculateRandomDistribution } from '#gw2/app/simulation/random-distribution/random-distribution.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2ProfessionSource } from '#gw2/platform/simulation/types.js';
import type { RandomDistributionJobRequest } from '#gw2/app/simulation/random-distribution/types.js';

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
 * Calculates one distribution batch directly through the profession engine.
 *
 * Progress responses have `{ requestId, progress }`. The terminal response has
 * the same request ID and either `distribution` or a string `error`.
 */
createGameWorkerEndpoint<Gw2ProfessionSource, RandomDistributionWorkerMessage>({
  calculate(profession, { includeSamples, request }, postUpdate) {
    const distribution = calculateRandomDistribution(
      request,
      (rotation, config) => simulateGw2({ profession, rotation, config }),
      {
        includeSamples: includeSamples === true,
        onProgress(progress) {
          postUpdate({ progress });
        }
      }
    );
    return { distribution };
  }
});
