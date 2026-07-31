import {
  guardianCoreEventHandlers,
  guardianCoreEventReactions,
} from "./core/handlers.js";
import { dragonhunterEventReactions } from "./specializations/dragonhunter/handlers.js";
import {
  firebrandEventHandlers,
  firebrandEventReactions,
} from "./specializations/firebrand/handlers.js";
import {
  luminaryEventHandlers,
  luminaryEventReactions,
} from "./specializations/luminary/handlers.js";
import { willbenderEventReactions } from "./specializations/willbender/handlers.js";

export const guardianResolverEventHandlers = Object.freeze({
  ...guardianCoreEventHandlers,
  ...firebrandEventHandlers,
  ...luminaryEventHandlers,
});

export const guardianResolverEventReactions = Object.freeze({
  damage: Object.freeze([
    ...guardianCoreEventReactions.damage,
    ...dragonhunterEventReactions.damage,
    ...firebrandEventReactions.damage,
    ...willbenderEventReactions.damage,
    ...luminaryEventReactions.damage,
  ]),
  buff: Object.freeze([
    ...guardianCoreEventReactions.buff,
    ...firebrandEventReactions.buff,
  ]),
});
