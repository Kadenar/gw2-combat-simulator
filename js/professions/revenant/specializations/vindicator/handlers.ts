import { augmentAfter } from "../../core/handler-strategies.js";
import {
  performEnergyMeld,
  switchAllianceTactics,
} from "./dodge.js";

const handlers = Object.freeze({
  "revenant.energy-meld": augmentAfter(performEnergyMeld),
  "revenant.alliance-tactics": augmentAfter(switchAllianceTactics),
});

export const vindicatorSkillHandlers = new Map(Object.entries(handlers));
export const vindicatorEventHandlers = Object.freeze({});
export const vindicatorEventReactions = Object.freeze({});
