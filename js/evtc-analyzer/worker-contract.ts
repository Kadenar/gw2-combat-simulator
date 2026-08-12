import type { SerializedEvtcError } from "./errors.js";
import type {
  DetectedPlayer,
  EvtcAnalysisResult,
  ParsedEvtcHeader,
} from "./types.js";
import type { EvtcProgressStage } from "./analyze.js";

export interface AnalyzeEvtcWorkerRequest {
  readonly type: "analyze";
  readonly requestId: number;
  readonly fileName: string;
  readonly buffer: ArrayBuffer;
}

export interface SelectEvtcPlayerWorkerRequest {
  readonly type: "select-player";
  readonly requestId: number;
  readonly playerAddress: string;
}

export type EvtcWorkerRequest =
  AnalyzeEvtcWorkerRequest | SelectEvtcPlayerWorkerRequest;

export type EvtcWorkerResponse =
  | {
      readonly type: "progress";
      readonly requestId: number;
      readonly stage: EvtcProgressStage;
    }
  | {
      readonly type: "selection-required";
      readonly requestId: number;
      readonly header: ParsedEvtcHeader;
      readonly encounter: {
        readonly speciesId: number;
        readonly name: string;
        readonly mapId: number | null;
      };
      readonly players: readonly DetectedPlayer[];
    }
  | {
      readonly type: "analysis";
      readonly requestId: number;
      readonly result: EvtcAnalysisResult;
    }
  | {
      readonly type: "error";
      readonly requestId: number;
      readonly error: SerializedEvtcError;
    };
