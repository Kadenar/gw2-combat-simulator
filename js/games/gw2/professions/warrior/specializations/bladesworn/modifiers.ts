import { cartridgeModifiers } from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';

import type { Gw2Stats } from '#gw2/platform/combat/types.js';

import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import { warriorActiveBuffStacks } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';

function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as Gw2MutableStats & { ferocity: number };
  if (hasTrait(context, TRAIT.GUNS_AND_GLORY) && runtimeBuffActive(context, 'guns-and-glory')) {
    const gunsAndGloryProfile = requireBalanceProfileFromContext(context, PROFILE.gunsAndGlory);
    result.ferocity += balanceProfileNumber(gunsAndGloryProfile, 'attributeBonus');
  }

  return result;
}

function runtimeBuffActive(context: Gw2ModifierContext, kind: string): boolean {
  const applications = context.runtime?.boons?.get(kind) || [];
  return applications.some(
    (application) =>
      application.resolvedAudience.includesSelf &&
      application.at <= context.time &&
      application.expiresAt > context.time
  );
}

const modifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    id: 'warrior.fierce-as-fire',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    // Apply profile tuning to live self stacks, preserving Core Warrior's stack and expiry policy.
    amount: (context) => {
      const profile = requireBalanceProfileFromContext(context, PROFILE.fierceAsFire);
      return (
        warriorActiveBuffStacks(context, 'fierce-as-fire', balanceProfileNumber(profile, 'maximumStacks')) *
        balanceProfileNumber(profile, 'damageIncreasePerStack')
      );
    },
    when: (context) => hasTrait(context, TRAIT.FIERCE_AS_FIRE)
  },
  ...cartridgeModifiers
]);

export const bladeswornModifiers = Object.freeze({
  modifyAttributes,
  modifierRules
});
