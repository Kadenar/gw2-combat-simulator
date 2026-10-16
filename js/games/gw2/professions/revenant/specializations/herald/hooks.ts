import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { completeRevenantCast } from '#gw2/professions/revenant/core/mechanics/completion.js';
import { revenantFacetParents } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { heraldBuffPolicies } from '#gw2/professions/revenant/specializations/herald/effect-state.js';
import { heraldUpkeepSettled } from '#gw2/professions/revenant/specializations/herald/mechanics/boundaries.js';
import {
  FACET_PULSE,
  facetPulse,
  startFacet,
  startConsume,
  completeConsume,
  heraldFacetAvailability
} from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import {
  natureSiphon,
  trueNatureDragon
} from '#gw2/professions/revenant/specializations/herald/skills/facet-of-nature.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Register facet and Nature owners while preserving Core rewards before elite completion and upkeep observers. */
export const heraldHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  buffPolicies: heraldBuffPolicies,
  initialize(runtime) {
    // Reject invalid selected relationships before any facet can spend Energy or arm a flip.
    revenantFacetParents(runtime.helpers.skillsById);
  },
  availability: heraldFacetAvailability,
  // Facet actions finish before the observer evaluates the resulting aggregate upkeep.
  onCastCancel(runtime) {
    runtime.fireTrigger(heraldUpkeepSettled, { at: runtime.time });
  },
  onCastCommit(runtime) {
    runtime.fireTrigger(heraldUpkeepSettled, { at: runtime.time });
  },
  sideEffectHandlers: {
    'revenant.start-facet'(runtime, context) {
      if (context.kind !== 'cast') return;

      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCast(runtime, context.cast);
      startFacet(runtime, context.skill);
    },
    'revenant.start-consume'(runtime, context) {
      if (context.kind === 'cast') startConsume(runtime, context.cast);
    },
    'revenant.complete-consume'(runtime, context) {
      if (context.kind !== 'cast') return;

      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCast(runtime, context.cast);
      completeConsume(runtime, context.cast);
    },
    'revenant.true-nature-dragon'(runtime, context) {
      if (context.kind === 'cast') trueNatureDragon(runtime, context.cast);
    }
  },
  reactions: {
    'damage.resolved': natureSiphon
  },
  // Sustained boon pulses are ambient; facet consumption and its damage keep their own queued effects.
  backgroundTasks: [FACET_PULSE],
  tasks: {
    [FACET_PULSE]: facetPulse
  }
};
