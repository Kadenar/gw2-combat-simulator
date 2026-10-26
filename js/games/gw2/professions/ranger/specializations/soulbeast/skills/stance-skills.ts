import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { leaderOfThePackStance } from '#gw2/professions/ranger/specializations/soulbeast/traits/behavior.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

/**
 * Owns Soulbeast stance declarations and activation packets, applying the trait-owned duration and sharing policy.
 * Hooks register these actions; specialization mechanics retain window reactions.
 */

export const SOULBEAST_STANCE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.VULTURE_STANCE]: {
    castTimeMs: 0,
    effects: [],
    // Activation opens the personal and trait-shared windows without waiting for recovery.
    sideEffects: [{ on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.vulture-stance' } }]
  },
  [ID.BEAR_STANCE]: {
    castTimeMs: 500,
    effects: []
  },
  [ID.ONE_WOLF_PACK]: {
    castTimeMs: 360,
    // The stance commits before recovery ends, so cancelling after activation retains its proc window.
    interruptCommitMs: 280,
    effects: [],
    // Activation opens the personal and trait-shared windows without waiting for recovery.
    sideEffects: [{ on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.one-wolf-pack' } }]
  }
});

/** Activate the ordinary personal stance, then deliver the trait-owned sharing policy. */
export function activateSoulbeastStance(runtime: RangerRuntime, skill: Skill, kind: string, profileId: string): number {
  const { duration, sharedDuration } = leaderOfThePackStance(
    runtime,
    balanceNumberFromContext(runtime, profileId, 'duration')
  );
  const application = {
    at: runtime.time,
    source: 'ranger',
    sourceId: skill.id,
    actorType: ACTOR.PLAYER,
    skillId: skill.id,
    skillName: skill.name,
    kind,
    duration,
    stacks: 1
  };
  runtime.effects.emit({ kind: 'packet', event: buildRangerPacket(application, 'buff') });

  if (sharedDuration != null)
    runtime.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          ...application,
          duration: sharedDuration,
          audience: { recipients: RECIPIENT.PARTY, affectsSelf: false, maximumRecipients: 4, eligibleCompanionIds: [] }
        },
        'buff'
      )
    });

  return duration;
}
