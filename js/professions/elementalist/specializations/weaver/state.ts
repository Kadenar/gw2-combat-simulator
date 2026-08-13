import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type {
  SchedulerConfig,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";

export interface WeaverState extends SchedulerRecord {
  weaveSelfUntil: number;
  weaveSelfVisited: string[];
  perfectWeaveUntil: number;
  ferventStanceUntil: number;
}

export const weaverState = defineProfessionSpecializationState(
  "Weaver",
  (_config: Readonly<SchedulerConfig> = {}): WeaverState => ({
    weaveSelfUntil: 0,
    weaveSelfVisited: [],
    perfectWeaveUntil: 0,
    ferventStanceUntil: 0,
  }),
);

export const createWeaverState = weaverState.create;
