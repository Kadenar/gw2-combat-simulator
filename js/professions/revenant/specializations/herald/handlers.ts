import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import type { SkillHandlerPhase } from "../../../../platform/engine/types.js";
import type { RevenantCastContext } from "../../types.js";
import { castElementalBlast, consumeRevenantFacet } from "./upkeep.js";

const handlers = Object.freeze({
  // Elemental Blast's catalog entry emits nothing; replaceSkill owns full beforeEffects, then consumeRevenantFacet tears down the facet in afterEffects.
  "revenant.elemental-blast": replaceSkill<RevenantCastContext>({
    beforeEffects: castElementalBlast as SkillHandlerPhase<RevenantCastContext>,
    afterEffects:
      consumeRevenantFacet as SkillHandlerPhase<RevenantCastContext>,
  }),
  // Other facet consumes emit their own effects via catalog data; augmentSkill appends teardown without replacing catalog behavior.
  "revenant.facet-consume": augmentSkill<RevenantCastContext>({
    afterEffects:
      consumeRevenantFacet as SkillHandlerPhase<RevenantCastContext>,
  }),
});

export const heraldSkillHandlers = new Map(Object.entries(handlers));
