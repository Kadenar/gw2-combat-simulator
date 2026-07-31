import {
  augmentAfter,
  replaceBefore,
} from "../../core/handler-strategies.js";
import {
  castElementalBlast,
  consumeRevenantFacet,
} from "./upkeep.js";

const handlers = Object.freeze({
  "revenant.elemental-blast": replaceBefore(
    castElementalBlast,
    consumeRevenantFacet,
  ),
  "revenant.facet-consume": augmentAfter(consumeRevenantFacet),
});

export const heraldSkillHandlers = new Map(Object.entries(handlers));

export const heraldEventHandlers = Object.freeze({});
export const heraldEventReactions = Object.freeze({});
