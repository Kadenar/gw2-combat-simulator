import { enqueueOrdered } from '../../../platform/engine/events/queue.js';
import { remainingTargetHealthFraction } from '../../../platform/gw2/combat/state/target-health.js';
import { rangerPetCompanionId } from './pets.js';
import type { RangerResolverContext, RangerResolverEvent, RangerSkill } from '../types.js';

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
  return {
    source: 'ranger-pet',
    actorType: 'summon',
    independentSummonStrike: event.independentSummonStrike,
    summonUsesProfessionModifiers: event.summonUsesProfessionModifiers,
    summonInheritsAttributes: event.summonInheritsAttributes,
    summonBasePower: event.summonBasePower,
    summonBasePrecision: event.summonBasePrecision,
    summonBaseFerocity: event.summonBaseFerocity,
    summonBaseConditionDamage: event.summonBaseConditionDamage,
    summonBaseExpertise: event.summonBaseExpertise,
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
  enqueueOrdered(context.queue, {
    ...petDerivedConditionMetadata(context, event),
    type: 'condition',
    at: event.at,
    source: petSource ? 'ranger-pet' : 'Trait',
    sourceId,
    actorType: petSource ? 'summon' : 'effect',
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
  enqueueOrdered(context.queue, {
    ...petDerivedConditionMetadata(context, event),
    type: 'condition',
    at: event.at,
    source: petSource ? 'ranger-pet' : 'Trait',
    sourceId,
    actorType: petSource ? 'summon' : 'effect',
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
