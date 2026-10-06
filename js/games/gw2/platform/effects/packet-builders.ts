import type { ConditionEventFields } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Packet builders for profession mechanics; all submission belongs to the shared emission service. */

/** A procedural strike whose total coefficient is divided across its hits. */
interface ProceduralStrike {
  readonly at: number;
  readonly coefficient: number;
  readonly hits?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
}

/**
 * Divides one procedural strike into single-hit packets so each hit is an independent resolved-hit fact. The total
 * coefficient is shared equally; `intervalSeconds` spaces consecutive hits, and explicit hit positions are kept.
 */
export function splitStrikeHits<T extends ProceduralStrike>(packet: T, intervalSeconds = 0): T[] {
  const hits = Math.max(1, Math.trunc(packet.hits ?? 1));
  return Array.from({ length: hits }, (_, index) => ({
    ...packet,
    at: packet.at + index * intervalSeconds,
    coefficient: (packet.coefficient || 0) / hits,
    hits: 1,
    hitIndex: packet.hitIndex ?? index + 1,
    totalHits: packet.totalHits ?? hits
  }));
}

/** Weapon identity for a mechanic's strike: the skill's own weapon, or none for utility and profession skills. */
export function proceduralSkillWeapon(skill: Pick<Skill, 'skillWeapon' | 'type' | 'weapon'>): string {
  return skill.skillWeapon ?? (skill.type === 'Weapon' ? skill.weapon || '' : 'Unequipped');
}

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
  return event.skillName || event.name || event.source || '';
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

/** Builds an unscaled positive effect; the shared emission service scales standard boons at application. */
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

/** Identifies explicit flat life steal, which bypasses ordinary strike modifiers. */
export function isFlatLifeStealPacket(event: Gw2ResolverEvent): boolean {
  return (
    event.damageKind === 'life-steal' &&
    [event.flatDamage, event.flatStrikeBase, event.flatStrikePowerCoeff].some(Number.isFinite)
  );
}
