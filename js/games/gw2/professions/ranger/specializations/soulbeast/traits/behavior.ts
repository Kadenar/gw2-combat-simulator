import { BOON, boonKey } from '#gw2/platform/effects/boons.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Leader of the Pack extends the personal stance and shares half of that extended window. */
export function leaderOfThePackStance(
  context: RangerRuntime,
  baseDuration: number
): { duration: number; sharedDuration?: number } {
  if (!hasTrait(context, TRAIT.LEADER_OF_THE_PACK)) return { duration: baseDuration };

  const duration = baseDuration * balanceNumberFromContext(context, TRAIT.LEADER_OF_THE_PACK, 'durationMultiplier');
  return {
    duration,
    sharedDuration: duration * balanceNumberFromContext(context, TRAIT.LEADER_OF_THE_PACK, 'sharedDurationMultiplier')
  };
}

// Essence of Speed reacts to each quickness application and extends all other boons by 2 s, with a 5 s ICD.
// Quickness itself is excluded from the extension to prevent runaway stacking.
export function essenceOfSpeedExtension(
  context: RangerResolverContext,
  event: Gw2ResolverEvent
): Gw2ResolverEvent | null {
  if (
    event.kind !== boonKey(BOON.QUICKNESS) ||
    !event.resolvedAudience?.includesSelf ||
    !hasTrait(context, TRAIT.ESSENCE_OF_SPEED) ||
    !context.procs.claim(TRAIT.ESSENCE_OF_SPEED, 'ranger.soulbeast.essenceOfSpeed', event.at)
  ) {
    return null;
  }

  return {
    type: 'boon_extension',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.ESSENCE_OF_SPEED,
    actorType: 'effect',
    skillId: TRAIT.ESSENCE_OF_SPEED,
    skillName: 'Essence of Speed',
    duration: balanceNumberFromContext(context, TRAIT.ESSENCE_OF_SPEED, 'duration'),
    excludedKind: boonKey(BOON.QUICKNESS)
  };
}
