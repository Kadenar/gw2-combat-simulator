import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { rangerBuffRequest } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

// Called from both enter- and exit-beastmode handlers; protection fires on every toggle regardless of direction.
export function applyUnstoppableUnion(context: RangerRuntime, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.UNSTOPPABLE_UNION)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.UNSTOPPABLE_UNION);
  const effect = requireEffect(profile, 'boon', 'protection');
  if (!effect) return;
  context.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
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
  });
}

/** Leader of the Pack extends the personal stance and shares half of that extended window. */
export function leaderOfThePackStance(
  context: RangerRuntime,
  baseDuration: number
): { duration: number; sharedDuration?: number } {
  if (!hasTrait(context, TRAIT.LEADER_OF_THE_PACK)) return { duration: baseDuration };
  const duration =
    baseDuration *
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LEADER_OF_THE_PACK), 'durationMultiplier');
  return { duration, sharedDuration: duration * 0.5 };
}

/** Runs once on the accepted first hit of the merged Beast ability. */
export function triggerMergedLiveFast(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.LIVE_FAST)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.LIVE_FAST);
    const fury = requireEffect(profile, 'boon', 'fury');
    const quickness = requireEffect(profile, 'boon', 'quickness');
    if (fury) context.effects.emit(rangerBuffRequest(event, profile, fury, 'Live Fast', TRAIT.LIVE_FAST));
    if (quickness) context.effects.emit(rangerBuffRequest(event, profile, quickness, 'Live Fast', TRAIT.LIVE_FAST));
  }
}

// Essence of Speed reacts to each quickness application and extends all other boons by 2 s, with a 5 s ICD.
// Quickness itself is excluded from the extension to prevent runaway stacking.
export function essenceOfSpeedExtension(
  context: RangerResolverContext,
  event: Gw2ResolverEvent
): Gw2ResolverEvent | null {
  if (
    event.kind !== 'quickness' ||
    !event.resolvedAudience?.includesSelf ||
    !hasTrait(context, TRAIT.ESSENCE_OF_SPEED) ||
    !context.procs.claim(TRAIT.ESSENCE_OF_SPEED, 'ranger.soulbeast.essenceOfSpeed', event.at)
  ) {
    return null;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.ESSENCE_OF_SPEED);
  return {
    type: 'boon_extension',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.ESSENCE_OF_SPEED,
    actorType: 'effect',
    skillId: TRAIT.ESSENCE_OF_SPEED,
    skillName: 'Essence of Speed',
    duration: balanceProfileNumber(profile, 'durationMultiplier'),
    excludedKind: 'quickness'
  };
}
