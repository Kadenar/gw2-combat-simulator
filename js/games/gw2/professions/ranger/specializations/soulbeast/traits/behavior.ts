import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { ACTOR, BOON } from '#gw2/platform/constants.js';
import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { balanceNumber, requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Leader of the Pack extends the personal stance and shares half of that extended window. */
export function leaderOfThePackStance(
  context: RangerRuntime,
  baseDuration: number
): { duration: number; sharedDuration?: number } {
  if (!hasTrait(context, TRAIT.LEADER_OF_THE_PACK)) return { duration: baseDuration };

  const duration = baseDuration * balanceNumber(context.helpers, TRAIT.LEADER_OF_THE_PACK, 'durationMultiplier');
  return {
    duration,
    sharedDuration: duration * balanceNumber(context.helpers, TRAIT.LEADER_OF_THE_PACK, 'sharedDurationMultiplier')
  };
}

/** Each eligible Quickness grant emits a trait-owned extension profile that excludes Quickness itself. */
export function essenceOfSpeedExtension(
  context: RangerResolverContext,
  event: Gw2ResolverEvent
): ProfileEmission | null {
  if (
    event.kind !== boonKey(BOON.QUICKNESS) ||
    !event.resolvedAudience?.includesSelf ||
    !hasTrait(context, TRAIT.ESSENCE_OF_SPEED) ||
    !context.procs.claim(TRAIT.ESSENCE_OF_SPEED, 'ranger.soulbeast.essenceOfSpeed', event.at)
  ) {
    return null;
  }

  return {
    kind: 'profile',
    profile: requireBalanceProfile(context.helpers, TRAIT.ESSENCE_OF_SPEED),
    at: event.at,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.ESSENCE_OF_SPEED,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.ESSENCE_OF_SPEED,
      skillName: 'Essence of Speed'
    },
    effects: [
      {
        type: 'custom',
        eventType: 'boon_extension',
        event: {
          duration: balanceNumber(context.helpers, TRAIT.ESSENCE_OF_SPEED, 'duration'),
          excludedKind: boonKey(BOON.QUICKNESS)
        }
      }
    ]
  };
}
