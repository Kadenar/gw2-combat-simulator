import { emitSkillBuff } from '../../../../../../platform/scheduler/skill-events.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '../../../../../../platform/scheduler/policy.js';
import { RANGER_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import type { RangerCastContext, RangerSkill } from '../../../types.js';
import { rangerBalanceProfile, rangerBalanceProfileEffect, rangerBalanceValue } from '../../../core/profiles.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

// Called from both enter- and exit-beastmode handlers; protection fires on every toggle regardless of direction.
export function applyUnstoppableUnion(context: RangerCastContext, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.UNSTOPPABLE_UNION)) return;
  const effect = rangerBalanceProfileEffect(rangerBalanceProfile(context, PROFILE.unstoppableUnion), 'boon');
  emitSkillBuff(context, {
    at: context.start,
    source: 'Trait',
    sourceId: TRAIT.UNSTOPPABLE_UNION,
    actorType: 'effect',
    skillId: skill.id,
    skillName: 'Unstoppable Union',
    kind: String(effect?.boon || 'protection'),
    duration: gw2SchedulerBoonDuration(
      context,
      skill,
      String(effect?.boon || 'protection'),
      Number(effect?.duration ?? 2.5)
    ),
    stacks: Number(effect?.stacks ?? 1)
  });
}

export function soulbeastStanceDuration(context: RangerCastContext, baseDuration: number): number {
  return hasTrait(context, TRAIT.LEADER_OF_THE_PACK)
    ? baseDuration * rangerBalanceValue(context, PROFILE.leaderOfThePack, 'durationMultiplier', 1.2)
    : baseDuration;
}
