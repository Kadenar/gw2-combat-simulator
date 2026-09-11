import { createGameWorkerEndpoint } from '#app/simulation/game-worker-harness.js';
import { loadProfession, loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { calculateRandomDistribution } from '#gw2/app/simulation/random-distribution/random-distribution.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { ProfessionAppContract } from '#gw2/app/types.js';
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
createGameWorkerEndpoint<ProfessionAppContract, RandomDistributionWorkerMessage>({
  async loadDriver({ gameId, contentId }) {
    if (gameId !== 'gw2') return null;
    // Ordinary RNG jobs need only the engine; authored previews retain their adapter composition.
    return activePatchPreview
      ? ((await loadProfessionAppAdapter(contentId))?.profession ?? null)
      : loadProfession(contentId);
  },
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
