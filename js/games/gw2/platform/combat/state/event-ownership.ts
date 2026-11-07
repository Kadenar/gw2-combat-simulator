/** Interprets actor inheritance for calculations, condition grouping, and derived effects. */
import { ACTOR, ACTOR_TYPES, type SimulationActorType } from '#gw2/platform/constants.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/events/events.js';

/** Reads explicit ownership; absent query events remain unknown and display labels never determine actors. */
export function gw2EventActorType(event: Partial<SimulationEventBase> | null | undefined): SimulationActorType {
  const explicit = event?.actorType || '';

  if (ACTOR_TYPES.has(explicit)) {
    return explicit as SimulationActorType;
  }

  return ACTOR.UNKNOWN;
}

export function isGw2PlayerActorEvent(event: Partial<SimulationEventBase> | null | undefined): boolean {
  // UNKNOWN is conservative: unclassified effects must not trigger player-only
  // sigils, food, or profession hit rules.
  return gw2EventActorType(event) === ACTOR.PLAYER;
}

/** Phantasm inheritance follows summon identity, independently of the packet's display label. */
export function isGw2PhantasmEvent(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return gw2EventActorType(event) === ACTOR.SUMMON && event?.summonKind === 'phantasm';
}

const ILLUSION_SUMMON_KINDS = new Set(['clone', 'phantasm', 'afterimage']);

/** Illusion critical policies apply only to explicitly identified clone, phantasm, and afterimage actors. */
export function isGw2IllusionEvent(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return gw2EventActorType(event) === ACTOR.SUMMON && ILLUSION_SUMMON_KINDS.has(event?.summonKind ?? '');
}

/**
 * Resolves whose outgoing modifiers an event inherits. Events without an
 * explicit owner retain their actor ownership.
 */
export function gw2EventOwnerActorType(event: Partial<SimulationEventBase> | null | undefined): SimulationActorType {
  const explicit = event?.ownerActorType || '';

  if (ACTOR_TYPES.has(explicit)) {
    return explicit as SimulationActorType;
  }

  return gw2EventActorType(event);
}

/** True when an event inherits the player's outgoing damage modifiers. */
export function isGw2PlayerModifierOwnedEvent(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return gw2EventOwnerActorType(event) === ACTOR.PLAYER;
}

/**
 * Identifies effect-owned damage that must not inherit a weapon profile from
 * the cast which triggered it, using explicit actor ownership only.
 */
export function isGw2NonWeaponEffectEvent(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return event?.actorType === ACTOR.EFFECT || event?.actorType === ACTOR.ENVIRONMENT;
}

/** Independent critical profiles do not represent player critical stats, regardless of damage attribution. */
export function usesIndependentCriticalProfile(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return (
    event?.independentSummonStrike === true &&
    event.summonInheritsAttributes !== true &&
    event.summonInheritsCriticalAttributes !== true
  );
}

/** Identifies summons whose conditions remain separate from the player's. */
export function isIndependentConditionOwner(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return event?.actorType === ACTOR.SUMMON && event.independentConditionOwner === true;
}

/** Conditions use their owner's bonuses without changing the original event's actor or strike profile. */
export function conditionOwnerEvent(event: SimulationEvent | null): SimulationEvent | null {
  if (event?.actorType !== ACTOR.SUMMON || isIndependentConditionOwner(event)) return event;

  return {
    ...event,
    actorType: ACTOR.PLAYER,
    ownerActorType: ACTOR.PLAYER,
    summonKind: undefined,
    summonOwner: undefined,
    independentSummonStrike: false,
    summonInheritsAttributes: true,
    summonIgnoresBoons: false,
    summonUsesEquipmentModifiers: true,
    summonUsesProfessionModifiers: true
  };
}

/** Shared condition owners accumulate and round together; unnamed independent applications remain isolated. */
export function conditionDamageOwner<T extends Partial<SimulationEventBase>>(application: T): string | T {
  if (application.actorType === ACTOR.SUMMON) {
    if (!isIndependentConditionOwner(application)) return ACTOR.PLAYER;

    return application.summonOwner ? `summon:${application.summonOwner}` : application;
  }

  if (
    application.actorType === ACTOR.PLAYER ||
    (application.actorType === ACTOR.EFFECT && application.ownerActorType === ACTOR.PLAYER)
  )
    return ACTOR.PLAYER;

  // Unclassified actors remain isolated until their producer supplies concrete ownership.
  return application;
}

const ACTOR_INHERITANCE_FIELDS = Object.freeze([
  'ownerActorType',
  'summonKind',
  'summonOwner',
  // Derived conditions retain the named companion even after it swaps out.
  'entityName',
  'independentSummonStrike',
  'independentConditionOwner',
  'summonInheritsAttributes',
  'summonInheritsCriticalAttributes',
  'summonIgnoresBoons',
  'summonUsesMight',
  'summonUsesEquipmentModifiers',
  'summonUsesProfessionModifiers',
  'summonBasePower',
  'summonBasePrecision',
  'summonBaseFerocity',
  'summonBaseConditionDamage',
  'summonBaseExpertise',
  'summonCriticalChance',
  'summonCriticalDamage',
  'summonDamagePerCoefficient'
]);

/** Carries ownership and scaling into derived effects; the producer still chooses the new event's actor type. */
export function derivedActorMetadata(event: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const field of ACTOR_INHERITANCE_FIELDS) {
    if (event[field] !== undefined) metadata[field] = event[field];
  }

  return metadata;
}
