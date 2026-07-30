import { loadProfessionAppAdapter } from "./profession-registry.js";

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
