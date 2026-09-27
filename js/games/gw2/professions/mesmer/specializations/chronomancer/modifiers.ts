/** Connects Chronomancer cast rules, trait modifiers, and runtime hooks to the specialization module. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2EventActorType, isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { timedActive } from '#gw2/professions/mesmer/core/modifiers.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

export const chronomancerModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.time-catches-up',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    // Time Catches Up affects only first-strike shatter packets against a movement-impaired target.
    when: (context) =>
      hasTrait(context, TRAIT.TIME_CATCHES_UP) &&
      Boolean(context.event?.metadata?.shatterTraitEligible) &&
      ['Chilled', 'Cripple', 'Immobilized', 'Slow'].some((condition) => targetConditionActive(context, condition))
  },
  {
    id: 'mesmer.flow-of-time-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, MESMER_TRAIT_IDS.FLOW_OF_TIME), 'criticalChance'),
    when: (context) =>
      hasTrait(context, TRAIT.FLOW_OF_TIME) &&
      Boolean(context.config?.boons?.alacrity) &&
      ['player', 'summon'].includes(gw2EventActorType(context.event))
  },
  {
    id: 'mesmer.danger-time',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: (context) =>
      1 +
      balanceProfileNumber(requireBalanceProfileFromContext(context, MESMER_TRAIT_IDS.DANGER_TIME), 'criticalDamage'),
    when: (context) =>
      hasTrait(context, TRAIT.DANGER_TIME) &&
      ['player', 'summon'].includes(gw2EventActorType(context.event)) &&
      timedActive(context, 'danger-time')
  },
  {
    id: 'mesmer.time-bomb',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => isGw2PlayerActorEvent(context.event) && timedActive(context, 'time-bomb')
  }
]);
