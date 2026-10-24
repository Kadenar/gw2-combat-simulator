import { createGameWorkerEndpoint } from '#browser/game/worker-harness.js';
import { calculateContributionBatch } from '#gw2/app/simulation/modifier-contributions/modifier-contributions.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { ModifierContributionBatchRequest } from '#gw2/app/simulation/modifier-contributions/types.js';

/**
 * The single request message this worker accepts. The application shell owns
 * pooling, result merging, cancellation, and stale-response handling.
 */
interface ModifierContributionsWorkerMessage {
  readonly requestId: number;
  readonly request: ModifierContributionBatchRequest;
}

/**
 * Calculates prepared comparisons through the engine without loading browser adapters.
 *
 * The worker posts one terminal response with the same request ID and either
 * batch scores or a string `error`.
 */
createGameWorkerEndpoint<Gw2ProfessionSource, ModifierContributionsWorkerMessage>({
  calculate(profession, { request }) {
    // Comparisons consume only DPS; chart histories belong to the separate detailed baseline.
    return calculateContributionBatch(request, (rotation, config) =>
      simulateGw2({ profession, rotation, config, output: 'score' })
    );
  }
});
