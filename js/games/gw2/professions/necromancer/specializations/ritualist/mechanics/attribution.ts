import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export function attribution(cast: RuntimeCast<NecromancerSkill>) {
  return {
    at: cast.effectiveEnd,
    source: 'Spirit',
    sourceId: cast.skill.id,
    actorType: 'player' as const,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    icon: cast.skill.icon,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  };
}

/** Keep spirit attribution consistent across committed player payloads and autonomous creature attacks. */
export function spiritFields(key: string, attackType: string) {
  return {
    summonKind: 'spirit',
    summonOwner: `spirit:${key}`,
    metadata: {
      spirit: key,
      spiritAttackType: attackType,
      anguishConditionalDamage: key === 'anguish' && attackType !== 'innervate'
    }
  };
}
