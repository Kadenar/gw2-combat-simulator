import { deadeyeSkillModifiers, markedTarget } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { boonActive, eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';

import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

function activeBoonCount(context: Gw2ModifierContext): number {
  return GW2_STANDARD_BOONS.filter((boon) => boonActive(context, boon)).length;
}

function modifyDeadeyeAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  // Skip build-time attribute bonuses already recorded in attribute provenance to avoid double-counting.
  if (!professionStaticRulesApplied(context.config)) {
    if (hasTrait(context, TRAIT.SILENT_SCOPE)) {
      const silentScopeProfile = requireBalanceProfileFromContext(context, PROFILE.silentScope);
      result.precision += balanceProfileNumber(silentScopeProfile, 'attributeBonus');
    }

    if (hasTrait(context, TRAIT.PREMEDITATION)) {
      const premeditationProfile = requireBalanceProfileFromContext(context, PROFILE.premeditation);
      result.concentration += balanceProfileNumber(premeditationProfile, 'attributeBonus');
    }
  }

  if (hasTrait(context, TRAIT.BE_QUICK_OR_BE_KILLED) && boonActive(context, 'quickness')) {
    const beQuickOrBeKilledProfile = requireBalanceProfileFromContext(context, PROFILE.beQuickOrBeKilled);
    const bonus = balanceProfileNumber(beQuickOrBeKilledProfile, 'attributeBonus');
    result.power += bonus;
    result.precision += bonus;
  }

  return result;
}

const deadeyeModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  ...deadeyeSkillModifiers,
  {
    id: 'thief.iron-sight',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.IRON_SIGHT) && markedTarget(context)
  },
  {
    id: 'thief.premeditation',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerBoon: 0.01 },
    factor: (context, _target, parameters) => 1 + activeBoonCount(context) * parameters.damagePerBoon,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.PREMEDITATION)
  },
  {
    id: 'thief.one-in-the-chamber',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.ONE_IN_THE_CHAMBER) &&
      Boolean(eventSkill(context)?.categories?.includes('stolen skill'))
  }
]);

export const deadeyeModifiers = Object.freeze({
  modifyAttributes: modifyDeadeyeAttributes,
  modifierRules: deadeyeModifierRules
});
