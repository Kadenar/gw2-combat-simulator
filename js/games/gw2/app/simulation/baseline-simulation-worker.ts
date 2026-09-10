import { createGameWorkerEndpoint } from '#app/simulation/game-worker-harness.js';
import { calculateBaselineSimulation } from '#gw2/app/simulation/baseline-simulation.js';
import { loadProfession, loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import type { BaselineSimulationRequest } from '#gw2/app/simulation/types.js';
import type { ProfessionAppContract } from '#gw2/app/types.js';

interface BaselineSimulationWorkerMessage {
  readonly requestId: number;
  readonly revision: number;
  readonly request: BaselineSimulationRequest;
  readonly warmup?: false;
}

interface BaselineWarmupMessage {
  readonly requestId: number;
  readonly revision: number;
  readonly request: Pick<BaselineSimulationRequest, 'gameId' | 'contentId'>;
  readonly warmup: true;
}

// The worker owns the expensive simulation while the shared endpoint preserves job identity.
createGameWorkerEndpoint<ProfessionAppContract, BaselineSimulationWorkerMessage | BaselineWarmupMessage>({
  echo: ({ revision }) => ({ revision }),
  async loadDriver({ gameId, contentId }) {
    if (gameId !== 'gw2') return null;
    // Ordinary baselines need only the profession engine; authored previews retain their adapter composition.
    return activePatchPreview
      ? ((await loadProfessionAppAdapter(contentId))?.profession ?? null)
      : loadProfession(contentId);
  },
  calculate(profession, message) {
    // Loading the driver is enough for warmup; never simulate or publish a placeholder rotation.
    if (message.warmup) return {};
    const { request } = message;
    return { output: calculateBaselineSimulation(request, profession) };
  }
});
