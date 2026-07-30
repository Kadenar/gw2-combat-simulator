import { loadProfessionAppAdapter } from "./profession-registry.js";

/**
 * Inputs for one worker-owned random-distribution batch.
 *
 * @typedef {Object} RandomDistributionWorkerRequest
 * @property {string} professionId Registry ID used to load the app adapter.
 * @property {*[]} rotation Rotation passed to each simulation.
 * @property {Object} baseConfig Base stochastic simulation configuration.
 * @property {number} trials Number of trials assigned to this worker.
 * @property {number} seedStart First seed in this worker's contiguous range.
 */

/**
 * Message accepted from the application shell.
 *
 * @typedef {Object} RandomDistributionWorkerMessage
 * @property {number} requestId Correlation ID used to reject stale responses.
 * @property {RandomDistributionWorkerRequest} request Distribution batch.
 * @property {boolean} [includeSamples=false] Include raw samples for
 * cross-worker aggregation.
 */

/**
 * Calculates one distribution batch through the profession's app adapter.
 *
 * Progress responses have `{ requestId, progress }`. The terminal response has
 * the same request ID and either `distribution` or a string `error`.
 * Cancellation and stale-response handling are owned by the application shell,
 * which terminates the worker when the request is superseded.
 */
self.addEventListener("message", async ({ data }) => {
  /** @type {RandomDistributionWorkerMessage} */
  const message = data;
  const { requestId, request } = message;
  try {
    const adapter = await loadProfessionAppAdapter(request.professionId);
    if (!adapter) {
      throw new Error(`No application adapter for ${request.professionId}.`);
    }
    const distribution = adapter.calculateRandomDistribution(request, {
      includeSamples: message.includeSamples === true,
      onProgress(progress) {
        self.postMessage({ requestId, progress });
      },
    });
    self.postMessage({ requestId, distribution });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
