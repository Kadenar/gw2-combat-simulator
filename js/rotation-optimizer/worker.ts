import { loadRotationOptimizerSimulation } from "./profession-loader.js";
import { runRotationSearch } from "./search.js";
import type {
  RotationOptimizerWorkerRequest,
  RotationOptimizerWorkerResponse,
} from "./types.js";

interface DedicatedWorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<RotationOptimizerWorkerRequest>) => void,
  ): void;
  postMessage(message: RotationOptimizerWorkerResponse): void;
}

const workerScope = self as unknown as DedicatedWorkerScope;

workerScope.addEventListener("message", async ({ data }) => {
  const { requestId, request } = data;
  try {
    const simulate = await loadRotationOptimizerSimulation(
      request.professionId,
    );
    if (!simulate) {
      throw new Error(`No optimizer simulation for ${request.professionId}.`);
    }
    const result = runRotationSearch(request, simulate, (progress) =>
      workerScope.postMessage({ requestId, progress }),
    );
    workerScope.postMessage({ requestId, result });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
