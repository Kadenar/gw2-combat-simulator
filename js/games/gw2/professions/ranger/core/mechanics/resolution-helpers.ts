import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import type { ConditionEffect, StatusEffect } from '#gw2/platform/effects/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import {
  rangerPetCombatMetadata,
  rangerPetCompanionId
} from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

/** Pet-sourced packets, including Ranger-stat effects that a pet skill launched. */
export function isPetStrike(event: { readonly source?: unknown } | null | undefined): boolean {
  return event?.source === 'ranger-pet';
}

/** Pet-sourced packets that the companion delivers itself, with its own attributes. */
export function isPetActorEvent(
  event: { readonly source?: unknown; readonly actorType?: unknown } | null | undefined
): boolean {
  return isPetStrike(event) && event?.actorType === 'summon';
}

/** A landed strike from the current pet lifetime; retired pets and Ranger-owned pet effects never qualify. */
export function isActivePetStrike(context: RangerResolverContext, event: Gw2ResolverEvent): boolean {
  const { pet } = professionCoreState(context);
  return pet != null && isPetActorEvent(event) && event.summonOwner === pet.id && Number(event.coefficient) > 0;
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
    summonOwner: event.summonOwner ?? rangerPetCompanionId(context),
    // Child conditions retain the triggering pet's name across a same-time swap.
    entityName: event.entityName ?? context.profession.core.activePet
  };
}

export function isPlayerStrike(event: Gw2ResolverEvent): boolean {
  return event.actorType === 'player' && !isPetStrike(event);
}

export function targetHealthFraction(context: RangerResolverContext): number {
  return context.combat.remainingTargetHealthFraction() ?? 1;
}

/**
 * Emit one surviving profile condition, boon, or buff under a trait or stance source. Ally-triggered hits keep their
 * ally provenance, and positive effects return to that ally instead of the Ranger.
 */
export function rangerProfileEffectRequest(
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  effect: ConditionEffect | StatusEffect,
  sourceId: number,
  name: string
): ProfileEmission & { attribution: EffectEventBase } {
  const triggeredByAlly = event.metadata?.triggeredByAlly;
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
      ...(effect.type === 'condition'
        ? {}
        : {
            name,
            audience: triggeredByAlly
              ? {
                  recipients: 'party',
                  alliedPlayerIndex: triggeredByAlly,
                  affectsSelf: false,
                  maximumRecipients: 1,
                  eligibleCompanionIds: []
                }
              : undefined
          }),
      metadata: { ...packet.metadata, ...(triggeredByAlly ? { triggeredByAlly } : {}) }
    })
  };
}
