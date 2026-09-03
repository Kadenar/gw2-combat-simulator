import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefRuntimeState, thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/traits/modifiers.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { DaredevilState, ThiefSchedulerContext } from '#gw2/professions/thief/types.js';
import { daredevilCastAvailability } from '#gw2/professions/thief/specializations/daredevil/mechanics/availability.js';
import { updatePalmStrikeWindow } from '#gw2/professions/thief/specializations/daredevil/mechanics/palm-strike.js';
import {
  applyDaredevilDodge,
  beginDaredevilTraits
} from '#gw2/professions/thief/specializations/daredevil/traits/index.js';

function initializeDaredevilRuntime(context: ThiefSchedulerContext): void {
  const state = professionCoreState(context);
  // Daredevil owns both its third dodge and the dynamic health conversion from Marauder's Resilience.
  state.maximumEndurance = Number(
    balanceProfileFromContext(context, 'thief.daredevil.resources')?.maximumStacks || 150
  );
  state.endurance = state.maximumEndurance;
  if (!professionStaticRulesApplied(context.config) && hasTrait(context.config, TRAIT.MARAUDERS_RESILIENCE)) {
    state.maximumHealth += Number(context.config.stats?.power ?? context.config.attributes?.power ?? 1000) * 0.7;
  }
}

export const daredevilSchedulerHooks = Object.freeze({
  initialize: {
    id: 'thief.daredevil-endurance',
    order: 10,
    handler: initializeDaredevilRuntime
  },
  // onCastStart runs before the cast so Staff Master / Brawler's Tenacity endurance and Weakening Strikes are armed in time
  onCastStart: beginDaredevilTraits,
  afterCast: Object.freeze([
    {
      id: 'thief.daredevil-dodge',
      // Order 30: runs after core thief afterCast (order 20) so endurance has already been deducted
      order: 30,
      handler: applyDaredevilDodge
    },
    {
      id: 'thief.daredevil-palm-strike',
      // Order 40: must follow dodge handler so the Palm Strike window is set after dodge effects are emitted
      order: 40,
      handler: updatePalmStrikeWindow
    }
  ])
});

export const daredevilModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'thief.weakening-strikes',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.WEAKENING_STRIKES) &&
      targetConditionActive(context, 'Weakness')
  },
  {
    id: 'thief.havoc-specialist',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.HAVOC_SPECIALIST) &&
      // Trait activates whenever endurance is not at maximum — any spent dodge qualifies
      Number(thiefRuntimeState(context).endurance || 0) < Number(thiefRuntimeState(context).maximumEndurance || 100)
  },
  {
    id: 'thief.bounding-dodger',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.BOUNDING_DODGER) &&
      Number(thiefRuntimeSpecializationState<DaredevilState>(context, 'Daredevil').boundingDamageUntil || 0) >
        context.time
  },
  {
    id: 'thief.lotus-training',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.LOTUS_TRAINING) &&
      Number(thiefRuntimeSpecializationState<DaredevilState>(context, 'Daredevil').lotusConditionDamageUntil || 0) >
        context.time
  }
]);

export const daredevilAttributeRules = Object.freeze({
  modifierRules: daredevilModifierRules
});

export const daredevilCastRules = Object.freeze({
  availability: {
    id: 'thief.daredevil-availability',
    order: 20,
    handler: daredevilCastAvailability
  }
});
