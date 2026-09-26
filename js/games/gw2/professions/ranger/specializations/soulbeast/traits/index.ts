import { emitRangerBuff, rangerEvent } from '#gw2/professions/ranger/core/events.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';

// Called from both enter- and exit-beastmode handlers; protection fires on every toggle regardless of direction.
export function applyUnstoppableUnion(context: RangerRuntime, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.UNSTOPPABLE_UNION)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.unstoppableUnion);
  const effect = requireEffect(profile, 'boon', 'protection');
  if (!effect) return;
  emitRangerBuff(
    context,
    rangerEvent(
      {
        at: context.time,
        source: 'Trait',
        sourceId: TRAIT.UNSTOPPABLE_UNION,
        actorType: 'effect',
        skillId: skill.id,
        skillName: 'Unstoppable Union',
        kind: String(effect.boon),
        duration: effectNumber(profile, effect, 'duration'),
        stacks: effectNumber(profile, effect, 'stacks')
      },
      'buff'
    )
  );
}

/** Share half the player's extended stance window without shortening the personal application. */
export function emitSoulbeastStance(
  context: RangerRuntime,
  skill: RangerSkill,
  kind: string,
  baseDuration: number
): number {
  const shared = hasTrait(context, TRAIT.LEADER_OF_THE_PACK);
  const duration = shared
    ? baseDuration *
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.leaderOfThePack), 'durationMultiplier')
    : baseDuration;
  const application = {
    at: context.time,
    source: 'ranger',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    kind,
    duration,
    stacks: 1
  };
  emitRangerBuff(context, rangerEvent(application, 'buff'));
  if (shared) {
    emitRangerBuff(
      context,
      rangerEvent(
        {
          ...application,
          duration: duration * 0.5,
          audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 4, eligibleCompanionIds: [] }
        },
        'buff'
      )
    );
  }

  return duration;
}
