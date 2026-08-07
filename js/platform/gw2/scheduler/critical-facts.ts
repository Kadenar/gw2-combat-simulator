import type {
  SchedulerContext,
  SimulationEvent,
} from "../../engine/types.js";
import { FOOD_DATA } from "../gear-data.js";
import { isGw2PlayerActorEvent } from "../event-ownership.js";
import type { Gw2Config } from "../types.js";
import type { MaterializerState } from "./materializer-state.js";

const PROC_PROGRESS_TOLERANCE = 1e-9;

export function hasStochasticCriticalFood(config: Gw2Config): boolean {
  return (
    config.randomness?.mode === "stochastic" &&
    FOOD_DATA[String(config.food || "")]?.proc?.type === "critStrike"
  );
}

/**
 * Samples and persists the hit's shared critical fact. A returned event is an
 * eligible critical-sigil cause; food and resolver logic consume the same fact.
 */
export function resolveCriticalTrigger(
  context: SchedulerContext,
  event: SimulationEvent,
  state: MaterializerState,
): SimulationEvent | null {
  if (!(Number(event.coefficient) > 0) || !state.criticalFactsRequired) {
    return null;
  }

  const canTriggerSigils =
    isGw2PlayerActorEvent(event) || event.canTriggerCriticalSigils === true;
  const critical = state.query!.critical(event, event.at, state);

  if (state.random.stochastic) {
    const didCrit = state.random.roll(
      critical.chance,
      `critical:${String(event.actorType || "player")}`,
    );
    const canonicalEvent =
      context.events.find((candidate) => candidate.__order === event.__order) ||
      event;
    const cause = context.replaceEvent(canonicalEvent, { didCrit });
    return didCrit && canTriggerSigils ? cause : null;
  }

  if (!canTriggerSigils || !(critical.chance > 0)) return null;
  state.sigil.criticalProgress += critical.chance;
  if (state.sigil.criticalProgress < 1 - PROC_PROGRESS_TOLERANCE) return null;
  state.sigil.criticalProgress -= 1;
  return event;
}
