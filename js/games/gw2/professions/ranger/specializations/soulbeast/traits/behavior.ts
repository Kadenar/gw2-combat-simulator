import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { rangerEvent } from '#gw2/professions/ranger/core/events.js';
import { queueProfileBuff } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerModifierContext,
  RangerResolverContext,
  RangerRuntime,
  RangerSkill
} from '#gw2/professions/ranger/types.js';

export function activeBuff(context: RangerModifierContext, kind: string): boolean {
  if (context.config?.boons?.[kind]) return true;
  if (context.timeline?.timedActive(kind, context.time)) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application: { at: number; expiresAt: number; stacks: number }) =>
      application.at <= context.time && application.expiresAt > context.time && application.stacks > 0
  );
}

// Called from both enter- and exit-beastmode handlers; protection fires on every toggle regardless of direction.
export function applyUnstoppableUnion(context: RangerRuntime, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.UNSTOPPABLE_UNION)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.UNSTOPPABLE_UNION);
  const effect = requireEffect(profile, 'boon', 'protection');
  if (!effect) return;
  context.emitProcedural(
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
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LEADER_OF_THE_PACK), 'durationMultiplier')
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
  context.emitProcedural(rangerEvent(application, 'buff'));
  if (shared) {
    context.emitProcedural(
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

/** Runs once on the accepted first hit of the merged Beast ability. */
export function triggerMergedLiveFast(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.LIVE_FAST)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.LIVE_FAST);
    const fury = requireEffect(profile, 'boon', 'fury');
    const quickness = requireEffect(profile, 'boon', 'quickness');
    if (fury) queueProfileBuff(context, event, profile, fury, 'Live Fast', TRAIT.LIVE_FAST);
    if (quickness) queueProfileBuff(context, event, profile, quickness, 'Live Fast', TRAIT.LIVE_FAST);
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
