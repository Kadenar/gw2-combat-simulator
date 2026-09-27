import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import {
  revenantActiveBoonCount,
  revenantRuntimeCoreState,
  revenantTimedBuff
} from '#gw2/professions/revenant/core/modifiers.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  heraldPassiveModifierRules,
  modifyHeraldPassiveAttributes
} from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';

const heraldModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.forceful-persistence',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // Each active facet contributes 10%, other upkeeps 25%; share Ferocious Aggression's additive bucket.
    amount: (context) =>
      (revenantRuntimeCoreState(context).activeUpkeeps || []).reduce(
        (bonus, upkeep) => bonus + (HERALD_BASE_SKILL_MECHANICS[Number(upkeep.skillId)]?.facet ? 0.1 : 0.25),
        0
      ),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.FORCEFUL_PERSISTENCE)
  },
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
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.REINFORCED_POTENCY)
  }
]);

export const heraldModifiers = Object.freeze({
  modifierRules: [...heraldModifierRules, ...heraldPassiveModifierRules],
  modifyAttributes: modifyHeraldPassiveAttributes
});
