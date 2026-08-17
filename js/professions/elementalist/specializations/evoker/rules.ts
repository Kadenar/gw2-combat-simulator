import { availability } from "./availability.js";
import { afterCast, onCastComplete, onCastStart } from "./familiars.js";
import { initialize } from "./resources.js";
import { onEventScheduled } from "./events.js";
import { modifyRechargeDuration } from "./recharge.js";
import { evokerModifierRules, modifyEvokerAttributes } from "./modifiers.js";

export { FAMILIAR_ELEMENTS } from "./constants.js";
export { applyAltruisticAspect } from "./traits.js";

export const evokerCastRules = Object.freeze({
  availability: {
    id: "elementalist.evoker-availability",
    order: 30,
    handler: availability,
  },
  modifyRechargeDuration,
});

export const evokerAttributeRules = Object.freeze({
  modifyAttributes: modifyEvokerAttributes,
  modifierRules: evokerModifierRules,
});

export const evokerSchedulerHooks = Object.freeze({
  initialize: {
    id: "elementalist.evoker-initialize",
    order: 30,
    handler: initialize,
  },
  onCastStart: {
    id: "elementalist.evoker-start",
    order: 30,
    handler: onCastStart,
  },
  afterCast: {
    id: "elementalist.evoker-after-cast",
    order: 30,
    handler: afterCast,
  },
  onCastComplete: {
    id: "elementalist.evoker-complete",
    order: 30,
    handler: onCastComplete,
  },
  onEventScheduled: {
    id: "elementalist.evoker-charges",
    order: 30,
    handler: onEventScheduled,
  },
});
