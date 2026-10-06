import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { applyRevealedTrainingAttributes } from '#gw2/professions/thief/core/traits/behavior.js';
import { applyNoQuarterAttributes } from '#gw2/professions/thief/core/traits/critical-boons.js';

import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const thiefCoreModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    order: 9,
    id: 'thief.distracting-throw-finisher',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && buffActive(context, 'distracting-throw')
  }
]);

// Reconcile build-time Thief stats with live signet, Revealed, and Fury state so
// passive and temporary attribute bonuses are applied exactly once.
function modifyThiefCoreAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const state = thiefRuntimeState(context);
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (hasSelectedSkillId(context, ID.SIGNET_OF_AGILITY)) {
    const signetOfAgilityProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfAgility);
    // Reconcile panel precision with recharge so the passive disappears only while the signet is unavailable.
    const passiveBonus = balanceProfileNumber(signetOfAgilityProfile, 'attributeBonus');
    const passiveDisabled = context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_AGILITY, context.time);
    if (staticRulesApplied && passiveDisabled) result.precision -= passiveBonus;
    if (!staticRulesApplied && !passiveDisabled) result.precision += passiveBonus;
  }

  if (hasSelectedSkillId(context, ID.ASSASSINS_SIGNET)) {
    const assassinsSignetProfile = requireBalanceProfileFromContext(context, PROFILE.assassinsSignet);
    const passive = balanceProfileNumber(assassinsSignetProfile, 'attributeBonus');
    const passiveDisabled = (state.assassinsSignetPassiveDisabledUntil || 0) > context.time;
    if (staticRulesApplied && passiveDisabled) result.power -= passive;
    if (!staticRulesApplied && !passiveDisabled) result.power += passive;
    if (buffActive(context, 'assassins-signet')) {
      result.power += balanceProfileNumber(assassinsSignetProfile, 'attributePerStack');
    }
  }

  applyRevealedTrainingAttributes(context, result);

  applyNoQuarterAttributes(context, result);

  return result;
}

export const thiefCoreModifiers = Object.freeze({
  modifyAttributes: modifyThiefCoreAttributes,
  modifierRules: thiefCoreModifierRules
});
