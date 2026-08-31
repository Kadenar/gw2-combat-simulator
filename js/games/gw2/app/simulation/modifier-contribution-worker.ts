import { createGameWorkerEndpoint } from '#app/simulation/game-worker-harness.js';
import type { Gw2AppAdapter, ModifierContributionRequest } from '#gw2/app/types.js';

/**
 * The single request message this worker accepts. The application shell owns
 * pooling, result merging, cancellation, and stale-response handling.
 */
interface ModifierContributionsWorkerMessage {
  readonly requestId: number;
  readonly request: ModifierContributionRequest;
}

/**
 * Calculates one comparison batch through the profession's app adapter.
 *
 * The worker posts one terminal response with the same request ID and either
 * `contributions` or a string `error`.
 */
createGameWorkerEndpoint<Gw2AppAdapter, ModifierContributionsWorkerMessage>({
  calculate(adapter, { request }) {
    return { contributions: adapter.calculateModifierContributions(request) };
  }
});
