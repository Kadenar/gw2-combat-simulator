import type { RangerSchedulerContext } from "../../types.js";
import { galeshotState } from "./state.js";

export function advanceGaleshotArrows(
  context: RangerSchedulerContext,
  target: number,
): void {
  const state = galeshotState.from(context);
  if (target <= state.arrowsUpdatedAt) return;
  state.arrows = Math.min(
    state.maximumArrows,
    state.arrows + (target - state.arrowsUpdatedAt) / 5,
  );
  state.arrowsUpdatedAt = target;
}
