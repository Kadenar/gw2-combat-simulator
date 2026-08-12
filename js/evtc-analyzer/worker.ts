import { analyzePreparedEvtc, prepareEvtcAnalysis } from "./analyze.js";
import { EvtcError, serializeEvtcError } from "./errors.js";
import type { EvtcProgressStage, PreparedEvtcAnalysis } from "./analyze.js";
import type {
  EvtcWorkerRequest,
  EvtcWorkerResponse,
} from "./worker-contract.js";

interface DedicatedWorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<EvtcWorkerRequest>) => void,
  ): void;
  postMessage(message: EvtcWorkerResponse): void;
}

const workerScope = self as unknown as DedicatedWorkerScope;
let prepared: PreparedEvtcAnalysis | null = null;
let activeRequestId = 0;

function post(message: EvtcWorkerResponse): void {
  workerScope.postMessage(message);
}

workerScope.addEventListener("message", async ({ data }) => {
  activeRequestId = data.requestId;
  const progress = (stage: EvtcProgressStage): void => {
    post({ type: "progress", requestId: data.requestId, stage });
  };
  try {
    if (data.type === "analyze") {
      prepared = await prepareEvtcAnalysis(data.buffer, progress);
      if (data.requestId !== activeRequestId) return;
      if (prepared.playerSelection.kind === "selection-required") {
        post({
          type: "selection-required",
          requestId: data.requestId,
          header: prepared.log.header,
          encounter: {
            speciesId: prepared.encounter.golem.speciesId,
            name: prepared.encounter.golem.name,
            mapId: prepared.encounter.mapId,
          },
          players: prepared.playerSelection.players,
        });
        return;
      }
      const result = await analyzePreparedEvtc(prepared, undefined, progress);
      if (data.requestId === activeRequestId) {
        post({ type: "analysis", requestId: data.requestId, result });
      }
      return;
    }
    if (!prepared) {
      throw new EvtcError(
        "PLAYER_NOT_FOUND",
        "The parsed log is no longer available. Select the file again.",
      );
    }
    const result = await analyzePreparedEvtc(
      prepared,
      data.playerAddress,
      progress,
    );
    if (data.requestId === activeRequestId) {
      post({ type: "analysis", requestId: data.requestId, result });
    }
  } catch (error) {
    if (data.requestId === activeRequestId) {
      post({
        type: "error",
        requestId: data.requestId,
        error: serializeEvtcError(error),
      });
    }
  }
});
