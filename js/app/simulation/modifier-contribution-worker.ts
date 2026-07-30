import { loadProfessionAppAdapter } from "../profession/registry.js";
import type { ModifierContributionRequest } from "../profession/types.js";

/**
 * The single request message this worker accepts. The application shell owns
 * pooling, result merging, cancellation, and stale-response handling.
 */
interface ModifierContributionsWorkerMessage {
  readonly requestId: number;
  readonly request: ModifierContributionRequest;
}

/**
 * Minimal dedicated-worker scope. The default DOM lib types `self` as a
 * `Window`, whose `postMessage` requires a target origin; a worker's does not.
 */
interface DedicatedWorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ModifierContributionsWorkerMessage>) => void,
  ): void;
  postMessage(message: unknown): void;
}

const workerScope = self as unknown as DedicatedWorkerScope;

/**
 * Calculates one comparison batch through the profession's app adapter.
 *
 * The worker posts one terminal response with the same request ID and either
 * `contributions` or a string `error`.
 */
workerScope.addEventListener("message", async ({ data }) => {
  const { requestId, request } = data;
  try {
    const adapter = await loadProfessionAppAdapter(request.professionId);
    if (!adapter) {
      throw new Error(`No application adapter for ${request.professionId}.`);
    }
    workerScope.postMessage({
      requestId,
      contributions: adapter.calculateModifierContributions(request),
    });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
