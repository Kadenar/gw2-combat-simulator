import { anguishConditionModifier } from '#gw2/professions/necromancer/specializations/ritualist/skills/index.js';
import { essenceBlastSpiritModifier } from '#gw2/professions/necromancer/specializations/ritualist/skills/index.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  cloneNecromancerAttributes,
  necromancerRuntimeSpecializationState
} from '#gw2/professions/necromancer/core/modifiers.js';

import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

// Apply Ritualist's build-time concentration bonus without double-counting pre-applied static rules.
function modifyRitualistAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  if (!professionStaticRulesApplied(context.config) && hasTrait(context, TRAIT.BOON_OF_CREATION)) {
    const boonOfCreationProfile = requireBalanceProfileFromContext(context, PROFILE.boonOfCreation);
    result.concentration += balanceProfileNumber(boonOfCreationProfile, 'attributeBonus');
  }

  return result;
}

const ritualistModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  essenceBlastSpiritModifier,
  {
    id: 'necromancer.lingering-spirits',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) =>
      hasTrait(context, TRAIT.LINGERING_SPIRITS) &&
      Boolean(necromancerRuntimeSpecializationState(context, 'Ritualist').activeSpirits?.anguish)
  },
  anguishConditionModifier,
  {
    id: 'necromancer.spirits-strength',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SPIRITS_STRENGTH), 'damageMultiplier'),
    // order: 100 ensures this multiplicative trait applies after all additive stacking (Lingering Spirits, Anguish conditional, etc.)
    order: 100,
    when: (context) =>
      (context.event?.actorType === 'summon' || context.event?.summonKind === 'spirit') &&
      // Innervate attacks are player-buffed abilities, not spirit autonomous attacks; the trait does not apply to them
      context.event.metadata?.spiritAttackType !== 'innervate' &&
      hasTrait(context, TRAIT.SPIRITS_STRENGTH)
  }
]);

export const ritualistModifiers = Object.freeze({
  modifyAttributes: modifyRitualistAttributes,
  modifierRules: ritualistModifierRules
});
