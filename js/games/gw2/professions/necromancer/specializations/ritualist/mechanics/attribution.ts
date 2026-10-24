import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export function attribution(cast: RuntimeCast<NecromancerSkill>) {
  return {
    at: cast.effectiveEnd,
    source: 'Spirit',
    sourceId: cast.skill.id,
    actorType: ACTOR.PLAYER,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    icon: cast.skill.icon,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  };
}

/** Summon ownership identifies the spirit; metadata carries only the attack distinctions used by traits. */
export function spiritFields(key: string, attackType: string) {
  return {
    summonKind: 'spirit',
    summonOwner: `spirit:${key}`,
    metadata: {
      spiritAttackType: attackType
    }
  };
}
