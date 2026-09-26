import { MODIFIER_TARGET, type Gw2ModifierContext, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';
function naturalBalanceActive(context: Gw2ModifierContext): boolean {
  // Natural Balance modifies the Druid, not independently scaled pet conditions.
  if (!isGw2PlayerModifierOwnedEvent(context.event) || !hasTrait(context, TRAIT.NATURAL_BALANCE)) return false;
  // Scheduler path uses a timeline; resolver path reads from the runtime boon list
  if (context.timeline?.timedActive('natural-balance', context.time)) return true;
  return (context.runtime?.boons?.get('natural-balance') || []).some(
    (application: { at: number; expiresAt: number; stacks: number }) =>
      application.at <= context.time && application.expiresAt > context.time && application.stacks > 0
  );
}

export const druidModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.natural-balance-condition-damage',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NATURAL_BALANCE), 'conditionDamageIncrease'),
    when: naturalBalanceActive
  },
  {
    id: 'ranger.natural-balance-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NATURAL_BALANCE), 'conditionDurationBonus'),
    when: naturalBalanceActive
  }
]);

/** Applies Druid-owned attribute bonuses without making Core aware of the specialization. */
function modifyDruidAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  if (!hasTrait(context, TRAIT.NATURAL_FORTITUDE)) return attributes;
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (staticRulesApplied && context.event?.actorType === 'summon') return attributes;
  const result = { ...attributes };
  const naturalFortitudeProfile = requireBalanceProfileFromContext(context, PROFILE.naturalFortitude);
  const vitality = balanceProfileNumber(naturalFortitudeProfile, 'attributeBonus');
  result.vitality = Number(result.vitality || 0) + (staticRulesApplied ? 0 : vitality);
  return result;
}

export const druidModifiers = Object.freeze({
  modifyAttributes: modifyDruidAttributes,
  modifierRules: druidModifierRules
});
