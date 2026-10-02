import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import type { EffectMetadata } from '#gw2/platform/engine/events/events.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { NecromancerSkill, NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export function emitHarbingerEffects(
  runtime: NecromancerRuntime,
  skill: Skill,
  effects: readonly SkillEffect[],
  cast?: RuntimeCast<NecromancerSkill>,
  metadata?: EffectMetadata
): void {
  emitEffects(runtime, {
    owner: skill,
    effects,
    baseEvent: (effect) => ({
      source: effect.source ?? (skill.type === 'Trait' ? 'Trait' : 'necromancer'),
      sourceId: effect.sourceId ?? skill.id,
      skillId: skill.id,
      skillName: skill.name,
      actorType: effect.actorType ?? (skill.type === 'Trait' ? 'effect' : 'player'),
      activationId: cast && skill.id !== cast.skill.id ? cast.id + ':effect:' + skill.id : cast?.id,
      metadata
    }),
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({
      ...event,
      parentSkillName: cast && cast.skill.id !== skill.id ? cast.skill.name : undefined,
      ...(event.type === 'damage' ? { name: skill.name } : {}),
      ...(event.type === 'condition' ? { name: skill.name + ' — ' + event.condition } : {}),
      offTarget: cast?.command.offTarget,
      at: canonicalTime(
        event.at +
          (skill.id === cast?.skill.id && isHostileTargetEvent(event) ? (cast.command.impactDelayMs ?? 0) / 1000 : 0)
      )
    })
  });
}

export function party(runtime: NecromancerRuntime) {
  return {
    recipients: 'party' as const,
    maximumRecipients: 5,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
  };
}
