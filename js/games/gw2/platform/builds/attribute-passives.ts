import type { Gw2AttributeContext, Gw2AttributeEffect } from '#gw2/platform/builds/types.js';
import { hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** A skill passive has one authored grant; readiness changes eligibility instead of subtracting a baked baseline. */
export function passiveAttribute(
  context: Gw2AttributeContext,
  skill: SkillId,
  profile: SkillId,
  to: string,
  field: string,
  active?: boolean | (() => boolean),
  multiplier = 1
): Gw2AttributeEffect {
  if (!hasSelectedSkillId(context, skill))
    return { kind: 'flat', to, amount: 0, feedsConversions: false, enabled: false };
  const enabled =
    typeof active === 'function' ? active() : (active ?? !context.timeline?.skillOnCooldownAt(skill, context.time));
  return {
    kind: 'flat',
    to,
    amount: balanceProfileNumber(requireBalanceProfileFromContext(context.balanceContext, profile), field) * multiplier,
    feedsConversions: false,
    enabled
  };
}
