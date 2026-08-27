import { createGameWorkerEndpoint } from '../../../../app/simulation/game-worker-harness.js';
import type { BaselineSimulationRequest } from '../types.js';
import type { Gw2AppAdapter } from '../types.js';

interface BaselineSimulationWorkerMessage {
  readonly requestId: number;
  readonly revision: number;
  readonly request: BaselineSimulationRequest;
}

// The worker owns the expensive simulation while the shared endpoint preserves job identity.
createGameWorkerEndpoint<Gw2AppAdapter, BaselineSimulationWorkerMessage>({
  echo: ({ revision }) => ({ revision }),
  calculate(adapter, { request }) {
    return { output: adapter.calculateBaselineSimulation(request) };
  }
});
