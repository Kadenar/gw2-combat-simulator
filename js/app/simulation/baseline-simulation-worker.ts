import { createProfessionWorkerEndpoint } from './profession-worker-harness.js';
import type { BaselineSimulationRequest } from '../profession/types.js';

interface BaselineSimulationWorkerMessage {
  readonly requestId: number;
  readonly revision: number;
  readonly request: BaselineSimulationRequest;
}

// The worker owns the expensive simulation while the shared endpoint preserves job identity.
createProfessionWorkerEndpoint<BaselineSimulationWorkerMessage>({
  echo: ({ revision }) => ({ revision }),
  calculate(adapter, { request }) {
    return { output: adapter.calculateBaselineSimulation(request) };
  }
});
