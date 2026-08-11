import type {
  RangerResolverContext,
  RangerResolverEvent,
} from "../../types.js";
import { galeshotState } from "./state.js";

export function handleGaleshotState(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  const state = galeshotState.from(context);
  state.windForce = Math.max(0, Math.min(5, Number(event.windForce || 0)));
  state.galeForceUntil = Math.max(0, Number(event.galeForceUntil || 0));
  state.mistralUntil = Math.max(0, Number(event.mistralUntil || 0));
  state.wutheringWindReady = Boolean(event.wutheringWindReady);
  state.wutheringWindReadyAt = Math.max(
    0,
    Number(event.wutheringWindReadyAt || 0),
  );
}

export const galeshotEventHandlers = Object.freeze({
  "ranger.galeshot-state": handleGaleshotState,
});
