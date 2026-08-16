import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { ElementalistConfig } from "../../types.js";

export interface WeaverState {
  unravelUntil: number;
  weaveSelfUntil: number;
  weaveSelfVisited: string[];
  perfectWeaveUntil: number;
  ferventStanceUntil: number;
}

export const weaverState = defineProfessionSpecializationState(
  "Weaver",
  (_config: ElementalistConfig = {}): WeaverState => ({
    unravelUntil: 0,
    weaveSelfUntil: 0,
    weaveSelfVisited: [],
    perfectWeaveUntil: 0,
    ferventStanceUntil: 0,
  }),
);

export const createWeaverState = weaverState.create;
