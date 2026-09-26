import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianTargetDisabled } from '#gw2/professions/guardian/core/traits/modifiers.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';

const dragonhunterModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.dragonhunter.pure-of-sight',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    order: 100,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.PURE_OF_SIGHT)
  },
  {
    id: 'guardian.dragonhunter.zealots-aggression',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOTS_AGGRESSION) && targetConditionActive(context, 'Crippled')
  },
  {
    id: 'guardian.dragonhunter.heavy-light',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, GUARDIAN_TRAIT_IDS.HEAVY_LIGHT) && guardianTargetDisabled(context)
  },
  {
    id: 'guardian.dragonhunter.big-game-hunter',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    // Uses context.time (resolver clock), not event.at, because modifier rules
    // are evaluated at the moment damage resolves, not when it was scheduled.
    when: (context) =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER) &&
      dragonhunterState.from(context).tetherUntil > context.time
  }
]);

export const dragonhunterAttributeRules = Object.freeze({
  modifierRules: dragonhunterModifierRules
});
