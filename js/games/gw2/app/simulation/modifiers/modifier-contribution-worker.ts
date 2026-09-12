import { createGameWorkerEndpoint } from '#app/simulation/game-worker-harness.js';
import { loadProfession } from '#gw2/app/profession/registry.js';
import { calculateContributionComparisons } from '#gw2/app/simulation/modifiers/modifier-contributions.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { ProfessionAppContract } from '#gw2/app/types.js';
import type { ModifierContributionRequest } from '#gw2/app/simulation/modifiers/types.js';

/**
 * The single request message this worker accepts. The application shell owns
 * pooling, result merging, cancellation, and stale-response handling.
 */
interface ModifierContributionsWorkerMessage {
  readonly requestId: number;
  readonly request: ModifierContributionRequest;
}

/**
 * Calculates prepared comparisons through the engine without loading browser adapters.
 *
 * The worker posts one terminal response with the same request ID and either
 * `contributions` or a string `error`.
 */
createGameWorkerEndpoint<ProfessionAppContract, ModifierContributionsWorkerMessage>({
  async loadDriver({ gameId, contentId }) {
    if (gameId !== 'gw2') return null;
    const profession = await loadProfession(contentId);
    return profession ? withActivePatchPreview(profession) : null;
  },
  calculate(profession, { request }) {
    return {
      contributions: calculateContributionComparisons(request, (rotation, config) =>
        simulateGw2({ profession, rotation, config })
      )
    };
  }
});
