/**
 * Stable application facade for the module-owned cast and scheduler hooks.
 */
import {
  thiefCoreCastRules,
  thiefCoreSchedulerHooks,
} from "../core/rules.js";
import {
  antiquaryCastRules,
} from "../specializations/antiquary/rules.js";

function modifyThiefRechargeDuration(context, duration) {
  const coreDuration =
    thiefCoreCastRules.modifyRechargeDuration(context, duration);
  return antiquaryCastRules.modifyRechargeDuration(context, coreDuration);
}

export const thiefCastRules = Object.freeze({
  ...thiefCoreCastRules,
  modifyRechargeDuration: modifyThiefRechargeDuration,
});

export const thiefSchedulerHooks = thiefCoreSchedulerHooks;
