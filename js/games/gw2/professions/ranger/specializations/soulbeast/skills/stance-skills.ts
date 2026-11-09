/** Stance profiles keep personal and shared applications under one occurrence with separate audiences. */

import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { leaderOfThePackStance } from '#gw2/professions/ranger/specializations/soulbeast/traits/behavior.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/**
 * Owns Soulbeast stance declarations and activation packets, applying the trait-owned duration and sharing policy.
 * Hooks register these actions; specialization mechanics retain window reactions.
 */

export const SOULBEAST_STANCE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.VULTURE_STANCE]: {
    name: 'Vulture Stance',
    icon: 'https://render.guildwars2.com/file/77A65F535049BFB5F209186B1E9BA125E6BE32B2/1770571.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Stance',
    cooldown: 30,
    duration: 6,
    internalCooldown: 0.25,
    castTimeMs: 0,
    effects: [],
    // Activation opens the personal and trait-shared windows without waiting for recovery.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: {
          type: 'ranger.vulture-stance',
          id: 'triggered-effects',
          effects: [
            { name: CONDITION.POISONED, type: 'condition', condition: CONDITION.POISONED, duration: 4, stacks: 1 },
            { name: BOON.MIGHT, type: 'boon', boon: BOON.MIGHT, duration: 4, stacks: 1 }
          ]
        }
      }
    ]
  },
  [ID.BEAR_STANCE]: {
    name: 'Bear Stance',
    icon: 'https://render.guildwars2.com/file/07944CB363A391A26B21C16F76F52111B32D96CD/1770561.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Stance',
    cooldown: 25,
    castTimeMs: 500,
    effects: []
  },
  [ID.ONE_WOLF_PACK]: {
    name: 'One Wolf Pack',
    icon: 'https://render.guildwars2.com/file/4E137B09B5CC545211977BFDCEC76119195AC7C9/1770558.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Stance',
    cooldown: 60,
    // Echo tuning remains independent from stance sharing and recipient cooldown state.
    duration: 6,
    internalCooldown: 1,
    echoDelay: 0.28,
    castTimeMs: 400,
    interruptCommitMs: 240,
    effects: [],
    // Queue the personal and shared windows at activation, before the remaining recovery finishes.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: {
          type: 'ranger.one-wolf-pack',
          id: 'echo',
          effects: [{ name: 'Strike', type: 'strike', coefficient: 0.95, hits: 1 }]
        }
      }
    ]
  }
};

/** Activate the ordinary personal stance, then deliver the trait-owned sharing policy. */
export function activateSoulbeastStance(runtime: RangerRuntime, skill: Skill, kind: string, at: number): void {
  const { duration, sharedDuration } = leaderOfThePackStance(runtime, skillNumber(skill, 'duration'));
  runtime.effects.emit({
    kind: 'profile',
    profile: skill,
    at,
    attribution: {
      source: 'ranger',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name
    },
    effects: [
      { type: 'buff', kind, duration, stacks: 1 },
      ...(sharedDuration == null
        ? []
        : [
            {
              type: 'buff' as const,
              kind,
              duration: sharedDuration,
              stacks: 1,
              audience: {
                recipients: RECIPIENT.PARTY,
                affectsSelf: false,
                maximumRecipients: 4,
                eligibleCompanionIds: []
              }
            }
          ])
    ],
    // Personal and shared stance packets retain the skill's display name.
    transform: (event) => ({ ...event, name: skill.name })
  });
}
