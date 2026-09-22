import type { ConditionEventFields } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

// Callers select ownership and provenance explicitly; a trigger is never a packet template.
type PacketFields = Pick<
  Gw2ResolverEvent,
  | 'at'
  | 'source'
  | 'sourceId'
  | 'actorType'
  | 'ownerActorType'
  | 'skillId'
  | 'skillName'
  | 'name'
  | 'triggeredBy'
  | 'metadata'
  | 'audience'
>;

/** Selects the triggering skill's display label without inheriting its combat metadata. */
export function resolverSourceSkill(event: Pick<Gw2ResolverEvent, 'skillName' | 'name' | 'source'>): string {
  return String(event.skillName || event.name || event.source || '');
}

/** Builds an unscaled condition; the caller chooses immediate application or ordered queueing. */
export function buildResolverCondition<
  T extends PacketFields & Pick<ConditionEventFields, 'condition' | 'stacks' | 'duration' | 'fixedDuration'>
>(fields: T) {
  return {
    name: `${fields.skillName || fields.sourceId || 'Condition'} — ${fields.condition}`,
    ...fields,
    type: 'condition' as const
  };
}

/** Builds an unscaled positive effect; fresh standard boons go through queueResolverBoon. */
export function buildResolverBuff<
  T extends PacketFields & { readonly kind: string; readonly duration: number; readonly stacks: number }
>(fields: T) {
  return { name: fields.skillName, ...fields, type: 'buff' as const };
}

/** Shares strike defaults while keeping coefficient and flat-strike formulas and crit policy caller-owned. */
export function buildResolverStrike<
  T extends PacketFields &
    (
      | { readonly coefficient: number }
      | { readonly flatDamage: number }
      | { readonly flatStrikeBase: number }
      | { readonly flatStrikePowerCoeff: number }
    )
>(fields: T) {
  return { name: fields.skillName, hits: 1, hitIndex: 1, totalHits: 1, ...fields, type: 'damage' as const };
}
