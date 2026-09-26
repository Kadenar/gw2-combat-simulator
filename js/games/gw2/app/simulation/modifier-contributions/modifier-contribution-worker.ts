import { createGameWorkerEndpoint } from '#app/game/worker-harness.js';
import { calculateContributionComparisons } from '#gw2/app/simulation/modifier-contributions/modifier-contributions.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2ProfessionSource } from '#gw2/platform/simulation/types.js';
import type { ModifierContributionRequest } from '#gw2/app/simulation/modifier-contributions/types.js';

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
createGameWorkerEndpoint<Gw2ProfessionSource, ModifierContributionsWorkerMessage>({
  calculate(profession, { request }) {
    return {
      contributions: calculateContributionComparisons(request, (rotation, config) =>
        simulateGw2({ profession, rotation, config })
      )
    };
  }
});
