import { loadProfessionAppAdapter } from './profession-registry.js';

self.addEventListener('message', async ({ data }) => {
    const { requestId, request } = data;
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
