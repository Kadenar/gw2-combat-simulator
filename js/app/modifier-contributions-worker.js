import {
    calculateModifierContributions,
} from '../professions/mesmer/app/app-runtime.js';

self.addEventListener('message', ({ data }) => {
    const { requestId, request } = data;
    try {
        self.postMessage({
            requestId,
            contributions: calculateModifierContributions(request),
        });
    } catch (error) {
        self.postMessage({
            requestId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
