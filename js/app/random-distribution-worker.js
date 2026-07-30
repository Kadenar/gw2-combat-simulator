import { loadProfessionAppAdapter } from "./profession-registry.js";

self.addEventListener("message", async ({ data }) => {
  const { requestId, request } = data;
  try {
    const adapter = await loadProfessionAppAdapter(request.professionId);
    if (!adapter) {
      throw new Error(`No application adapter for ${request.professionId}.`);
    }
    const distribution = adapter.calculateRandomDistribution(request, {
      includeSamples: data.includeSamples === true,
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
