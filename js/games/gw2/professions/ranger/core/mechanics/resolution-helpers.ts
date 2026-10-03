import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { ProfileEmission } from '#gw2/platform/simulation/effect-emission.js';
import { remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import type { Gw2RuntimeStateLike } from '#gw2/platform/combat/state/targets.js';
import { targetHasCondition } from '#gw2/platform/combat/state/targets.js';
import type { BalanceProfile, ConditionEffect, StatusEffect } from '#gw2/platform/engine/skills/types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { rangerPetCombatMetadata, rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import type { RangerResolverContext, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Restricts Stalker's Strike's bonus to its three documented movement-impairing conditions. */
export function stalkersStrikeTargetImpaired(
  config: Gw2Config = {},
  at: number,
  runtime: Gw2RuntimeStateLike | null = null
): boolean {
  return ['Crippled', 'Slow', 'Immobilized'].some((condition) => targetHasCondition(config, condition, at, runtime));
}

export function eventSkill(context: RangerResolverContext, event: Gw2ResolverEvent): RangerSkill | undefined {
  return event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
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

export function buildRangerBleeding(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  duration: number,
  sourceId: number,
  name: string,
  stacks = 1
): SimulationEventBase {
  // Preserve the Bleeding row label while sharing condition ownership and packet construction.
  return buildRangerCondition(context, event, 'Bleeding', duration, stacks, sourceId, name, `${name} — Bleeding`);
}

export function buildRangerCondition(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  condition: string,
  duration: number,
  stacks: number,
  sourceId: number,
  name: string,
  displayName = `${name} - ${condition}`
): SimulationEventBase {
  const petSource = isPetStrike(event);
  // Keep trait packets effect-sourced for proc gating while making non-pet ownership explicit.
  return buildResolverCondition({
    ...petDerivedConditionMetadata(context, event),

    at: event.at,
    source: petSource ? 'ranger-pet' : 'Trait',
    sourceId,
    actorType: petSource ? 'summon' : 'effect',
    ownerActorType: petSource ? undefined : 'player',
    skillId: sourceId,
    skillName: name,
    name: displayName,
    condition,
    duration,
    stacks,
    triggeredBy: event.skillName
  });
}

export function isPlayerStrike(event: Gw2ResolverEvent): boolean {
  return event.actorType === 'player' && !isPetStrike(event);
}

export function targetHealthFraction(context: RangerResolverContext): number {
  return remainingTargetHealthFraction(context.config, context) ?? 1;
}

/** Emit one surviving profile condition with its authored identity, stacks, and duration. */
export function rangerConditionRequest(
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  effect: ConditionEffect,
  sourceId: number,
  name: string
): ProfileEmission {
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
): ProfileEmission {
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
