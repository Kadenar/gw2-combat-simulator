import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { RevenantCastContext } from '#gw2/professions/revenant/types.js';
import { consumeRevenantFacet } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-upkeep.js';

/** Appends facet teardown after each consume skill's catalog effects. */
export const heraldSkillHandlers = new Map([
  [
    'revenant.facet-consume',
    augmentSkill<RevenantCastContext>({
      afterEffects: consumeRevenantFacet as SkillHandlerPhase<RevenantCastContext>
    })
  ]
]);
