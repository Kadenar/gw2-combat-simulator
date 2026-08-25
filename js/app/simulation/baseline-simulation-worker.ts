import { loadProfessionAppAdapter } from '../profession/registry.js';
import type { BaselineSimulationRequest } from '../profession/types.js';

interface BaselineSimulationWorkerMessage {
  readonly requestId: number;
  readonly revision: number;
  readonly request: BaselineSimulationRequest;
}

interface DedicatedWorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<BaselineSimulationWorkerMessage>) => void): void;
  postMessage(message: unknown): void;
}

const workerScope = self as unknown as DedicatedWorkerScope;

// The worker owns the expensive simulation so authoring interactions remain responsive.
workerScope.addEventListener('message', async ({ data }) => {
  const { requestId, revision, request } = data;
  try {
    const adapter = await loadProfessionAppAdapter(request.professionId);
    if (!adapter) throw new Error(`No application adapter for ${request.professionId}.`);
    workerScope.postMessage({
      requestId,
      revision,
      output: adapter.calculateBaselineSimulation(request)
    });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      revision,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
