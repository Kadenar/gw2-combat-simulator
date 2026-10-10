import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import type { ConditionEffect, StatusEffect } from '#gw2/platform/effects/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import {
  rangerPetCombatMetadata,
  rangerPetCompanionId
} from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

/** Restricts Stalker's Strike's bonus to its three documented movement-impairing conditions. */
export function stalkersStrikeTargetImpaired(hasCondition: (condition: string) => boolean): boolean {
  return ['Crippled', 'Slow', 'Immobilized'].some(hasCondition);
}

export function isPetStrike(event: Gw2ResolverEvent): boolean {
  return event.source === 'ranger-pet';
}

export function petDerivedConditionMetadata(
  context: RangerResolverContext,
  event: Gw2ResolverEvent
): Record<string, unknown> {
  if (!isPetStrike(event)) return {};
  // Derived pet conditions always use the active pet's independent attributes,
  // even when ArcDPS attributes the triggering command strike to the player.
  return {
    ...rangerPetCombatMetadata(context),
    summonOwner: event.summonOwner ?? rangerPetCompanionId(context)
  };
}

export function isPlayerStrike(event: Gw2ResolverEvent): boolean {
  return event.actorType === 'player' && !isPetStrike(event);
}

export function targetHealthFraction(context: RangerResolverContext): number {
  return context.combat.remainingTargetHealthFraction() ?? 1;
}

/** Emit one surviving profile condition with its authored identity, stacks, and duration. */
export function rangerConditionRequest(
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  effect: ConditionEffect,
  sourceId: number,
  name: string
): ProfileEmission & { attribution: EffectEventBase } {
  // Trait source and ally targeting are mechanic data; the service owns materialization and live duration.
  return {
    kind: 'profile',
    profile,
    effects: [effect],
    at: event.at,
    durationContext: event,
    attribution: {
      source: 'Trait',
      sourceId,
      actorType: 'effect',
      skillId: sourceId,
      skillName: name,
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,

      metadata: {
        ...packet.metadata,
        ...(event.metadata?.triggeredByAlly ? { triggeredByAlly: event.metadata.triggeredByAlly } : {})
      }
    })
  };
}

/** Emit one surviving boon or buff; its identity comes from the authored boon or buff kind. */
export function rangerBuffRequest(
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  effect: StatusEffect,
  name: string,
  sourceId: number
): ProfileEmission & { attribution: EffectEventBase } {
  // Trait source and ally targeting are mechanic data; the service owns materialization and live duration.
  return {
    kind: 'profile',
    profile,
    effects: [effect],
    at: event.at,
    durationContext: event,
    attribution: {
      source: 'Trait',
      sourceId,
      actorType: 'effect',
      skillId: sourceId,
      skillName: name,
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      name,
      audience: event.metadata?.triggeredByAlly
        ? {
            recipients: 'party',
            alliedPlayerIndex: event.metadata.triggeredByAlly,
            affectsSelf: false,
            maximumRecipients: 1,
            eligibleCompanionIds: []
          }
        : undefined,
      metadata: {
        ...packet.metadata,
        ...(event.metadata?.triggeredByAlly ? { triggeredByAlly: event.metadata.triggeredByAlly } : {})
      }
    })
  };
}
