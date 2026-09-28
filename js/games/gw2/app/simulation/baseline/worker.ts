import { createGameWorkerEndpoint } from '#browser/game/worker-harness.js';
import { calculateBaselineSimulation } from '#gw2/app/simulation/baseline/baseline-simulation.js';
import type { BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';
import type { Gw2ProfessionSource } from '#gw2/platform/simulation/types.js';

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
createGameWorkerEndpoint<Gw2ProfessionSource, BaselineSimulationWorkerMessage | BaselineWarmupMessage>({
  calculate(profession, message) {
    // Loading the driver is enough for warmup; never simulate or publish a placeholder rotation.
    if (message.warmup) return {};
    const { request } = message;
    return { output: calculateBaselineSimulation(request, profession) };
  }
});
