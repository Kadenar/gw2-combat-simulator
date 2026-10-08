import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { wieldedConjure } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
import { applyAirTraitAttributes } from '#gw2/professions/elementalist/core/traits/air/index.js';
import { applyArcaneTraitAttributes } from '#gw2/professions/elementalist/core/traits/arcane/index.js';
import { reconcileSignetPassive } from '#gw2/professions/elementalist/core/traits/earth/index.js';
import {
  applyFireTraitAttributes,
  applyInfernoAttributes
} from '#gw2/professions/elementalist/core/traits/fire/index.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';

/**
 * Non-trait resource modifiers remain here; registered traits own their own rules.
 */
export const elementalistCoreModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    id: 'elementalist.hammer-fire-orb',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => activeBuffStacks(context, 'hammer fire orb', 1) > 0
  },
  {
    id: 'elementalist.hammer-air-orb',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => activeBuffStacks(context, 'hammer air orb', 1) > 0
  },
  {
    id: 'elementalist.frost-bow-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'multiply',
    factor: 1.2,
    when: (context) => wieldedConjure(context) === 'Frost Bow'
  }
]);

// Apply live attunement, timed-buff, conjure, and signet attribute changes at
// event time; build-time bonuses are intentionally handled upstream.
export function modifyElementalistAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified: Gw2MutableStats = { ...attributes };

  applyFireTraitAttributes(context, modified);

  applyAirTraitAttributes(context, modified);

  applyArcaneTraitAttributes(context, modified);

  // Read equipped state at damage resolution so dropping or expiry also removes the bonuses from lingering hits.
  const weapon = wieldedConjure(context);
  if (weapon === 'Fiery Greatsword') {
    const fieryGreatswordProfile = requireBalanceProfileFromContext(context, PROFILE.fieryGreatsword);
    modified.power = (modified.power || 0) + balanceProfileNumber(fieryGreatswordProfile, 'weaponAttributeBonus');
    modified.conditionDamage =
      (modified.conditionDamage || 0) + balanceProfileNumber(fieryGreatswordProfile, 'attributeBonus');
  } else if (weapon === 'Lightning Hammer') {
    const lightningHammerProfile = requireBalanceProfileFromContext(context, PROFILE.lightningHammer);
    modified.precision =
      (modified.precision || 0) + balanceProfileNumber(lightningHammerProfile, 'weaponAttributeBonus');
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(lightningHammerProfile, 'attributeBonus');
  }

  // Remove baseline passive precision during live recharge, including resets, unless Written in Stone preserves it.
  reconcileSignetPassive(context, modified);

  return modified;
}

/** The Core module composes ordered live trait helpers with non-trait attribute and resource rules. */
export const elementalistCoreModifiers = Object.freeze({
  modifyAttributes: modifyElementalistAttributes,
  // Inferno uses the same final-Power conversion as Sharpshooter, with Burning's authored coefficient.
  modifyConditionAttributes: applyInfernoAttributes,
  modifierRules: elementalistCoreModifierRules
});
