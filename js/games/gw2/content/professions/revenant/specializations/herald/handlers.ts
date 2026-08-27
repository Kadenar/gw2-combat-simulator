import { augmentSkill } from '../../../../../integrations/patches/authoring/mechanics.js';
import type { SkillHandlerPhase } from '../../../../../platform/engine/types.js';
import type { RevenantCastContext } from '../../types.js';
import { consumeRevenantFacet } from './upkeep.js';

const handlers = Object.freeze({
  // Facet consumes emit their effects via catalog data; augmentSkill appends teardown without replacing catalog behavior.
  'revenant.facet-consume': augmentSkill<RevenantCastContext>({
    afterEffects: consumeRevenantFacet as SkillHandlerPhase<RevenantCastContext>
  })
});

export const heraldSkillHandlers = new Map(Object.entries(handlers));
