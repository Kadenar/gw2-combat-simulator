import { handleThiefState } from "./events.js";
import {
  reactToThiefCoreBuff,
  reactToThiefCoreCondition,
  reactToThiefCoreDamage,
  thiefCoreCriticalReactions,
} from "./traits.js";

export { handleThiefState } from "./events.js";
export {
  reactToThiefCoreBuff,
  reactToThiefCoreCondition,
  reactToThiefCoreDamage,
  thiefCoreCriticalReactions,
} from "./traits.js";

export const thiefCoreEventHandlers = Object.freeze({
  "thief.state": handleThiefState,
});

export const thiefCoreEventReactions = Object.freeze({
  critical: Object.freeze([
    thiefCoreCriticalReactions.unrelentingStrikes,
    thiefCoreCriticalReactions.noQuarter,
  ]),
  damage: Object.freeze([
    {
      id: "thief.core.damage",
      order: 30,
      handler: reactToThiefCoreDamage,
    },
  ]),
  condition: Object.freeze([
    {
      id: "thief.core.condition",
      order: 0,
      handler: reactToThiefCoreCondition,
    },
  ]),
  buff: Object.freeze([
    {
      id: "thief.core.buff",
      order: 30,
      handler: reactToThiefCoreBuff,
    },
  ]),
});
