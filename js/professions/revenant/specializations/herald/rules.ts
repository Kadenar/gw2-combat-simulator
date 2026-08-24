import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import type { Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import { revenantCombatActive } from '../../core/legend.js';
import { emitLegendInvocationProfile, emitLegendInvocationSkill } from '../../core/legend-traits.js';
import { revenantActiveBoonCount, revenantPlayer, revenantTimedBuff } from '../../core/rules.js';
import { hasRevenantTrait } from '../../core/state.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '../../data/ids.js';
import type { RevenantSchedulerContext, RevenantSimulationEvent } from '../../types.js';
import { HERALD_SPIRIT_BOON_PROFILE_ID } from './skills.js';
import { afterHeraldFacetCast, handleHeraldFacetPulse } from './upkeep.js';
import { denyRevenantSkill } from '../../core/availability.js';
import type { RevenantPrecastContext, RevenantSkill } from '../../types.js';

export const heraldModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.burst-of-strength-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // "burst-of-strength" is a timed buff key written by the skill handler, not a boon; it uses revenantTimedBuff rather than boon tracking.
    amount: 0.1,
    when: (context) => revenantTimedBuff(context, 'burst-of-strength')
  },
  {
    id: 'revenant.burst-of-strength-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => revenantTimedBuff(context, 'burst-of-strength')
  },
  {
    id: 'revenant.reinforced-potency',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // +1% per unique active boon; capped at 12 boon types so the theoretical maximum is +12%.
    amount: (context) => revenantActiveBoonCount(context) * 0.01,
    when: (context) => revenantPlayer(context) && hasTrait(context, TRAIT.REINFORCED_POTENCY)
  }
]);

export const heraldAttributeRules = Object.freeze({
  modifierRules: heraldModifierRules
});

function heraldCastAvailability(context: RevenantPrecastContext, skill: RevenantSkill) {
  const state = professionCoreState(context);
  if (skill.consume && !state.availableFlips[skill.id]) {
    return denyRevenantSkill(skill, 'revenant.facet-inactive', 'activate the matching facet first.');
  }

  if (skill.facet && state.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id)) {
    return denyRevenantSkill(skill, 'revenant.facet-active', 'the facet is already active; consume it instead.');
  }

  return { ready: true as const };
}

export const heraldCastRules = Object.freeze({
  availability: {
    id: 'revenant.herald-facet-availability',
    order: 20,
    handler: heraldCastAvailability
  }
});

function observeHeraldEvent(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  // activeLegendId is already updated to the destination legend by the time sigil_swap is emitted, so this tests the legend just swapped into.
  if (
    event.type !== 'sigil_swap' ||
    professionCoreState(context).activeLegendId !== LEGEND.DRAGON ||
    !revenantCombatActive(context, event.at)
  ) {
    return;
  }

  if (hasRevenantTrait(context.config, TRAIT.SPIRIT_BOON)) {
    emitLegendInvocationProfile(context, HERALD_SPIRIT_BOON_PROFILE_ID, event.at, TRAIT.SPIRIT_BOON);
  }

  if (!hasRevenantTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) return;
  emitLegendInvocationSkill(context, ID.CALL_OF_THE_DRAGON, event.at, TRAIT.SONG_OF_THE_MISTS);
}

export const heraldSchedulerHooks = Object.freeze({
  afterCast: {
    id: 'revenant.herald-facet-start',
    order: 20,
    handler: afterHeraldFacetCast
  },
  onEventScheduled: {
    id: 'revenant.herald-legend-invocation',
    // order: 20 places this after the core weapon/spear observers (order 10) so legend state is stable before invocation fires.
    order: 20,
    handler: observeHeraldEvent
  },
  taskHandlers: Object.freeze({
    'revenant.herald-facet-pulse': handleHeraldFacetPulse
  })
});
