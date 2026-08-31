import { enqueueOrdered } from '#kernel/events/queue.js';
import { remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import { rangerPetCombatMetadata, rangerPetCompanionId } from '#gw2/content/professions/ranger/core/mechanics/pets.js';
import type { RangerResolverContext, RangerResolverEvent, RangerSkill } from '#gw2/content/professions/ranger/types.js';

export function eventSkill(context: RangerResolverContext, event: RangerResolverEvent): RangerSkill | undefined {
  return event.skillId == null
    ? undefined
    : (context.helpers.skillsById?.get(event.skillId) as RangerSkill | undefined);
}

export function isPetStrike(event: RangerResolverEvent): boolean {
  return event.source === 'ranger-pet';
}

export function petDerivedConditionMetadata(
  context: RangerResolverContext,
  event: RangerResolverEvent
): Record<string, unknown> {
  if (!isPetStrike(event)) return {};
  // Derived pet conditions always use the active pet's independent attributes,
  // even when ArcDPS attributes the triggering command strike to the player.
  return {
    ...rangerPetCombatMetadata(context),
    summonOwner: event.summonOwner ?? rangerPetCompanionId(context)
  };
}

export function queueBleeding(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  duration: number,
  sourceId: number,
  name: string,
  stacks = 1
): void {
  const petSource = isPetStrike(event);
  // Keep trait packets effect-sourced for proc gating while making non-pet ownership explicit.
  enqueueOrdered(context.queue, {
    ...petDerivedConditionMetadata(context, event),
    type: 'condition',
    at: event.at,
    source: petSource ? 'ranger-pet' : 'Trait',
    sourceId,
    actorType: petSource ? 'summon' : 'effect',
    ownerActorType: petSource ? undefined : 'player',
    skillId: sourceId,
    skillName: name,
    name: `${name} — Bleeding`,
    condition: 'Bleeding',
    duration,
    stacks,
    triggeredBy: event.skillName
  });
}

export function queueCondition(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  condition: string,
  duration: number,
  stacks: number,
  sourceId: number,
  name: string
): void {
  const petSource = isPetStrike(event);
  // Keep trait packets effect-sourced for proc gating while making non-pet ownership explicit.
  enqueueOrdered(context.queue, {
    ...petDerivedConditionMetadata(context, event),
    type: 'condition',
    at: event.at,
    source: petSource ? 'ranger-pet' : 'Trait',
    sourceId,
    actorType: petSource ? 'summon' : 'effect',
    ownerActorType: petSource ? undefined : 'player',
    skillId: sourceId,
    skillName: name,
    name: `${name} - ${condition}`,
    condition,
    duration,
    stacks,
    triggeredBy: event.skillName
  });
}

export function isPlayerStrike(event: RangerResolverEvent): boolean {
  return event.actorType === 'player' && !isPetStrike(event);
}

export function targetHealthFraction(context: RangerResolverContext): number {
  return remainingTargetHealthFraction(context.config, context) ?? 1;
}
