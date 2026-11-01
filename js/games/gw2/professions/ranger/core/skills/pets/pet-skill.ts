/** Pet actions share one independent actor lane and recharge from boons received by the pet. */
import { RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export function definePetSkill<T extends SkillDefinition<RangerSkill>>(skill: T) {
  return {
    ...skill,
    petSkill: true,
    independentCast: true,
    independentCastCanOverlap: true,
    usableWhileRecharging: true,
    rechargeOwner: 'actor' as const,
    rechargeAnchor: 'castStart' as const,
    rechargeBuffAudience: RECIPIENT.SUMMONS
  };
}
