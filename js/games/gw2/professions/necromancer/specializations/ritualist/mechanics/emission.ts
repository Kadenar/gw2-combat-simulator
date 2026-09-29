import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { necromancerActiveBoonCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';

export function attribution(cast: RuntimeCast) {
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

export function boon(
  runtime: NecromancerRuntime,
  cast: RuntimeCast,
  profile: Skill,
  effects: readonly SkillEffect[]
): void {
  emitEffects(runtime, {
    owner: profile,
    effects,
    baseEvent: { ...attribution(cast), source: 'necromancer' },
    transform: (event) => ({
      ...event,
      icon: cast.skill.icon,
      offTarget: cast.command.offTarget,
      audience: {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: necromancerActiveBoonCompanionIds(runtime)
      }
    })
  });
}
