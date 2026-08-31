/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/types.js';
import type { RevenantCastContext } from '#gw2/content/professions/revenant/types.js';
import { consumeRevenantFacet } from '#gw2/content/professions/revenant/specializations/herald/mechanics/facet-upkeep.js';

const handlers = Object.freeze({
  // Facet consumes emit their effects via catalog data; augmentSkill appends teardown without replacing catalog behavior.
  'revenant.facet-consume': augmentSkill<RevenantCastContext>({
    afterEffects: consumeRevenantFacet as SkillHandlerPhase<RevenantCastContext>
  })
});

export const heraldSkillHandlers = new Map(Object.entries(handlers));
