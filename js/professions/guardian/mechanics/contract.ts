/**
 * Stable full-roster facade retained for application imports. Simulations use
 * the module-local rule and scheduler-hook fragments.
 */
import {
  guardianCoreCastRules,
  guardianCoreSchedulerHooks,
} from "../core/rules.js";
import {
  firebrandCastRules,
  firebrandSchedulerHooks,
} from "../specializations/firebrand/rules.js";
import {
  luminaryCastRules,
  luminarySchedulerHooks,
} from "../specializations/luminary/rules.js";

export const guardianCastRules = Object.freeze({
  availability: Object.freeze([...(firebrandCastRules.availability || [])]),
  validateCast: Object.freeze([
    ...(guardianCoreCastRules.validateCast || []),
    ...(firebrandCastRules.validateCast || []),
    ...(luminaryCastRules.validateCast || []),
  ]),
});

export const guardianSchedulerHooks = Object.freeze({
  advance: Object.freeze([
    ...(guardianCoreSchedulerHooks.advance || []),
    ...(firebrandSchedulerHooks.advance || []),
    ...(luminarySchedulerHooks.advance || []),
  ]),
  afterCast: Object.freeze([
    ...(guardianCoreSchedulerHooks.afterCast || []),
    ...(firebrandSchedulerHooks.afterCast || []),
    ...(luminarySchedulerHooks.afterCast || []),
  ]),
  onCastComplete: Object.freeze([
    ...(luminarySchedulerHooks.onCastComplete || []),
  ]),
  onEventScheduled: Object.freeze([
    ...(guardianCoreSchedulerHooks.onEventScheduled || []),
    ...(firebrandSchedulerHooks.onEventScheduled || []),
    ...(luminarySchedulerHooks.onEventScheduled || []),
  ]),
});
