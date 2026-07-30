import { loadProfessionAppAdapter } from "./profession-registry.js";

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
