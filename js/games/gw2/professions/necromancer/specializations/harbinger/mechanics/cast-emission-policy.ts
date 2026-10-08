import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { EffectMetadata } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Preserve cast ownership and independent trait payloads while delaying only the cast's hostile delivery. */
export function harbingerCastEmissionPolicy(
  cast: RuntimeCast<NecromancerSkill>,
  skill: Skill,
  metadata?: EffectMetadata
): Pick<ProfileEmission, 'attribution' | 'transform' | 'skillWeaponFallback'> {
  return {
    attribution: (effect) => ({
      source: effect.source ?? (skill.type === 'Trait' ? 'Trait' : 'necromancer'),
      sourceId: effect.sourceId ?? skill.id,
      skillId: skill.id,
      skillName: skill.name,
      actorType: effect.actorType ?? (skill.type === 'Trait' ? 'effect' : 'player'),
      activationId: skill.id !== cast.skill.id ? cast.id + ':effect:' + skill.id : cast.id,
      metadata
    }),
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({
      ...event,
      parentSkillName: cast.skill.id !== skill.id ? cast.skill.name : undefined,
      ...(event.type === 'damage' ? { name: skill.name } : {}),
      ...(event.type === 'condition' ? { name: skill.name + ' — ' + event.condition } : {}),
      offTarget: cast.command.offTarget,
      at: canonicalTime(
        event.at +
          (skill.id === cast.skill.id && isHostileTargetEvent(event) ? (cast.command.impactDelayMs ?? 0) / 1000 : 0)
      )
    })
  };
}
