import { loadProfessionAppAdapter } from "./profession-registry.js";

/**
 * Inputs for one worker-owned modifier comparison batch.
 *
 * @typedef {Object} ModifierContributionsWorkerRequest
 * @property {string} professionId Registry ID used to load the app adapter.
 * @property {*[]} rotation Rotation shared by all comparisons.
 * @property {Object} baseConfig Baseline simulation configuration.
 * @property {Object[]} comparisons Modifier-omission configurations assigned
 * to this worker.
 */

/**
 * Message accepted from the application shell.
 *
 * @typedef {Object} ModifierContributionsWorkerMessage
 * @property {number} requestId Correlation ID used to reject stale responses.
 * @property {ModifierContributionsWorkerRequest} request Comparison batch.
 */

/**
 * Calculates one comparison batch through the profession's app adapter.
 *
 * The worker posts one terminal response with the same request ID and either
 * `contributions` or a string `error`. Pooling, result merging, cancellation,
 * and stale-response handling are owned by the application shell.
 */
self.addEventListener("message", async ({ data }) => {
  /** @type {ModifierContributionsWorkerMessage} */
  const message = data;
  const { requestId, request } = message;
  try {
    const adapter = await loadProfessionAppAdapter(request.professionId);
    if (!adapter) {
      throw new Error(`No application adapter for ${request.professionId}.`);
    }
    self.postMessage({
      requestId,
      contributions: adapter.calculateModifierContributions(request),
    });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
