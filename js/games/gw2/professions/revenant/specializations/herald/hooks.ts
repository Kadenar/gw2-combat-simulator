import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { heraldBuffPolicies } from '#gw2/professions/revenant/specializations/herald/effect-state.js';
import { heraldFacetLifecycle } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import { heraldUpkeepSettled } from '#gw2/professions/revenant/specializations/herald/mechanics/trigger-points.js';
import {
  natureSiphon,
  trueNatureDragon
} from '#gw2/professions/revenant/specializations/herald/skills/facet-of-nature.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Register facet and Nature owners while preserving Core rewards before elite completion and upkeep observers. */
export const heraldHooks = composeRuntimeHooks<RevenantRuntimeState, RevenantSkill>([
  heraldFacetLifecycle,
  {
    buffPolicies: heraldBuffPolicies,
    // Facet actions finish before the observer evaluates the resulting aggregate upkeep.
    onCastCancel(runtime) {
      runtime.fireTrigger(heraldUpkeepSettled);
    },
    onCastCommit(runtime) {
      runtime.fireTrigger(heraldUpkeepSettled);
    },
    sideEffectHandlers: {
      'revenant.true-nature-dragon'(runtime, context) {
        if (context.kind === 'cast') trueNatureDragon(runtime, context.cast);
      }
    },
    reactions: {
      'damage.resolved': natureSiphon
    }
  }
]);
