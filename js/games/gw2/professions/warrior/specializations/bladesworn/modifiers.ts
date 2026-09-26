import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
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

function cartridgeDamageBonus(context: Gw2ModifierContext): number {
  // A newer cartridge application replaces the older bonus, even after the newer one expires.
  let latest = { at: -Infinity, expiresAt: 0, kind: '' };
  for (const kind of ['overcharged-cartridges', 'supercharged-cartridges']) {
    for (const application of context.runtime?.boons?.get(kind) ?? []) {
      if (application.resolvedAudience.includesSelf && application.at <= context.time && application.at >= latest.at)
        latest = { at: application.at, expiresAt: application.expiresAt, kind };
    }
  }

  if (latest.expiresAt <= context.time) return 0;
  const profile = requireBalanceProfileFromContext(context, PROFILE.overchargedCartridges);
  const effect = requireEffect(profile, 'buff', latest.kind);
  return effect ? effectNumber(profile, effect, 'damageIncreasePerStack') : 0;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.fierce-as-fire',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      maximumStacks: 10,
      damagePerStack: 0.01
    } as Readonly<Record<string, number>>,
    // Count live self applications only, matching Core Warrior's stack and expiry policy.
    amount: (context, _target, parameters) =>
      warriorActiveBuffStacks(context, 'fierce-as-fire', parameters.maximumStacks) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.FIERCE_AS_FIRE)
  },
  {
    id: 'warrior.overcharged-cartridges',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { baseFactor: 1 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => parameters.baseFactor + cartridgeDamageBonus(context),
    when: (context) => context.event?.damageKind === 'explosion' && cartridgeDamageBonus(context) > 0
  }
]);

export const bladeswornModifiers = Object.freeze({
  modifyAttributes,
  modifierRules
});
