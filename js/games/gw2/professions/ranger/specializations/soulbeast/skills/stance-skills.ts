import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
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
    // Activation opens the personal and trait-shared windows without waiting for recovery.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.vulture-stance' } }
    ],
    castTimeMs: 0,
    effects: []
  },
  [ID.BEAR_STANCE]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.ONE_WOLF_PACK]: {
    // Activation opens the personal and trait-shared windows without waiting for recovery.
    sideEffects: [{ on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.one-wolf-pack' } }],
    // The stance commits before recovery ends, so cancelling after activation retains its proc window.
    interruptCommitMs: 280,
    effects: [],
    castTimeMs: 360
  }
});

/** Activate the ordinary personal stance, then deliver the trait-owned sharing policy. */
export function activateSoulbeastStance(runtime: RangerRuntime, skill: Skill, kind: string, profileId: string): number {
  const { duration, sharedDuration } = leaderOfThePackStance(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, profileId), 'durationMultiplier')
  );
  const application = {
    at: runtime.time,
    source: 'ranger',
    sourceId: skill.id,
    actorType: 'player' as const,
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
          audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 4, eligibleCompanionIds: [] }
        },
        'buff'
      )
    });
  return duration;
}
