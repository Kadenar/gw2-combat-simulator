import { ATTRIBUTE_NAMES } from '#gw2/platform/attributes/inputs.js';
import type { Gw2AttributeContext, Gw2AttributeEffect } from '#gw2/platform/attributes/types.js';
import { hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillAttributeKey, SkillId } from '#gw2/platform/skills/types.js';

type FlatAttributeEffect = Extract<Gw2AttributeEffect, { readonly kind: 'flat' }>;

/**
 * Turns a skill or profile's own `attributeBonuses` into flat final-attribute grants. The caller owns eligibility (a held
 * conjure, a ready signet), while the amounts come from the selected owner so patches edit a single owner.
 */
export function ownerAttributeEffects(skill: Pick<Skill, 'attributeBonuses'>): FlatAttributeEffect[] {
  return Object.entries(skill.attributeBonuses ?? {}).map(([attribute, amount]) => ({
    kind: 'flat',
    to: ATTRIBUTE_NAMES[attribute as SkillAttributeKey],
    amount,
    feedsConversions: 'none'
  }));
}

/**
 * Signet-style passives granted by the skill's own `attributeBonuses`: only an equipped skill contributes, and by
 * default only while it is off cooldown. An unequipped skill is never read, so catalog-free previews stay valid;
 * contribution analysis only discovers passives of selected skills, which always report their (possibly disabled) grants.
 */
export function passiveSkillAttributes(
  context: Gw2AttributeContext,
  skillId: SkillId,
  active?: boolean | (() => boolean),
  multiplier = 1
): FlatAttributeEffect[] {
  if (!hasSelectedSkillId(context, skillId)) return [];

  const skill = requireSkillFromContext(context.balanceContext, skillId);
  const enabled =
    typeof active === 'function' ? active() : (active ?? !context.timeline?.skillOnCooldownAt(skillId, context.time));
  const effects: FlatAttributeEffect[] = [];

  // Construct final grants directly to avoid intermediate copies while readiness remains live for each query.
  for (const [attribute, amount] of Object.entries(skill.attributeBonuses ?? {})) {
    effects.push({
      kind: 'flat',
      to: ATTRIBUTE_NAMES[attribute as SkillAttributeKey],
      amount: amount * multiplier,
      feedsConversions: 'none',
      passiveSkillId: skillId,
      enabled
    });
  }

  return effects;
}
