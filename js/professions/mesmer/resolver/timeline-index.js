import { EPSILON } from "../../../platform/engine/clock.js";
import {
  createGw2TimelineIndex,
} from "../../../platform/gw2/timeline-index.js";

/**
 * Adds Mesmer instrument queries to the common GW2 timeline index.
 */
export function createTimelineIndex({ config, events, sigilSet }) {
  const common = createGw2TimelineIndex({ config, events, sigilSet });
  const instrumentEvents = events.filter(
    event => event.type === "mesmer.instrument",
  );
  const instrumentsAt = time =>
    instrumentEvents.filter(
      event => event.at <= time + EPSILON && event.expiresAt > time,
    );
  return Object.freeze({ ...common, instrumentsAt });
}
