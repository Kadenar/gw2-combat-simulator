import { simulate } from "../engine/simulation.js";
import { createCommonEventHandlers } from "./event-handlers.js";

export function simulateGw2(options) {
  return simulate({
    ...options,
    commonHandlers: createCommonEventHandlers(),
  });
}
