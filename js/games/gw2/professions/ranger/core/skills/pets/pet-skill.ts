/** Pet actions share one independent actor lane and recharge from boons received by the pet. */
import { RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

// A concrete parameter keeps excess-property checks on each authored pet literal; a generic would absorb typos.
export function definePetSkill(skill: SkillDefinition<RangerSkill>): SkillDefinition<RangerSkill> {
  return {
    ...skill,
    petSkill: true,
    independentCast: true,
    independentCastCanOverlap: true,
    usableWhileRecharging: true,
    rechargeOwner: 'actor',
    rechargeAnchor: 'castStart',
    rechargeBuffAudience: RECIPIENT.SUMMONS
  };
}
