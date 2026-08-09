import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import { paragonState } from "./state.js";
import type {
  WarriorResolverContext,
  WarriorResolverEvent,
} from "../../types.js";

function handleParagonState(
  context: WarriorResolverContext,
  event: WarriorResolverEvent,
): void {
  const state = paragonState.from(context);
  for (const [key, value] of Object.entries(event.state || {})) {
    (state as unknown as SchedulerRecord)[key] = structuredClone(value);
  }
}

export const paragonResolverEventHandlers = Object.freeze({
  "paragon.state": handleParagonState,
});
