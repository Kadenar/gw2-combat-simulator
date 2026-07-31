/**
 * Stable family-level cast and scheduler facade. Runtime simulation composes
 * the Core slice with only the selected elite module.
 */
import { engineerCastModifiers } from "../attribute-rules.js";
import { engineerCoreSchedulerHooks } from "../core/rules.js";
import {
  amalgamSchedulerHooks,
} from "../specializations/amalgam/handlers.js";
import {
  holosmithSchedulerHooks,
} from "../specializations/holosmith/handlers.js";
import {
  mechanistSchedulerHooks,
} from "../specializations/mechanist/handlers.js";
import {
  scrapperSchedulerHooks,
} from "../specializations/scrapper/handlers.js";
import { engineerCastAvailability } from "./availability.js";

export const engineerCastRules = Object.freeze({
  availability: {
    id: "engineer.availability",
    order: 10,
    handler: engineerCastAvailability,
  },
  ...engineerCastModifiers,
});

export const engineerSchedulerHooks = Object.freeze({
  initialize: mechanistSchedulerHooks.initialize,
  onEventScheduled: Object.freeze([
    engineerCoreSchedulerHooks.onEventScheduled,
    mechanistSchedulerHooks.onEventScheduled,
    amalgamSchedulerHooks.onEventScheduled,
    holosmithSchedulerHooks.onEventScheduled,
  ]),
  advance: Object.freeze([
    engineerCoreSchedulerHooks.advance,
    holosmithSchedulerHooks.advance,
  ]),
  afterCast: Object.freeze([
    ...engineerCoreSchedulerHooks.afterCast,
    scrapperSchedulerHooks.afterCast,
    mechanistSchedulerHooks.afterCast,
    holosmithSchedulerHooks.afterCast,
  ]),
  taskHandlers: Object.freeze({
    ...engineerCoreSchedulerHooks.taskHandlers,
    ...mechanistSchedulerHooks.taskHandlers,
    ...amalgamSchedulerHooks.taskHandlers,
    ...holosmithSchedulerHooks.taskHandlers,
  }),
});
