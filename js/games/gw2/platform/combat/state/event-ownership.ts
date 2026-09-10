import type { SimulationEventInput } from '#gw2/platform/engine/events/types.js';

export type Gw2EventActorType = 'player' | 'summon' | 'effect' | 'environment' | 'unknown';

// Ownership controls which effects may trigger player-only procs. It is
// intentionally independent from display-oriented source labels.
export const GW2_EVENT_ACTOR_TYPES = Object.freeze({
  PLAYER: 'player',
  SUMMON: 'summon',
  EFFECT: 'effect',
  ENVIRONMENT: 'environment',
  UNKNOWN: 'unknown'
});

/** Reads explicit ownership; absent query events remain unknown and display labels never determine actors. */
export function gw2EventActorType(event: Partial<SimulationEventInput> | null | undefined): Gw2EventActorType {
  const explicit = String(event?.actorType || '');
  if (Object.values(GW2_EVENT_ACTOR_TYPES).includes(explicit as Gw2EventActorType)) {
    return explicit as Gw2EventActorType;
  }

  return GW2_EVENT_ACTOR_TYPES.UNKNOWN;
}

export function isGw2PlayerActorEvent(event: Partial<SimulationEventInput> | null | undefined): boolean {
  // UNKNOWN is conservative: unclassified effects must not trigger player-only
  // sigils, food, or profession hit rules.
  return gw2EventActorType(event) === GW2_EVENT_ACTOR_TYPES.PLAYER;
}

/**
 * Resolves whose outgoing modifiers an event inherits. Events without an
 * explicit owner retain their actor ownership.
 */
export function gw2EventOwnerActorType(event: Partial<SimulationEventInput> | null | undefined): Gw2EventActorType {
  const explicit = String(event?.ownerActorType || '');
  if (Object.values(GW2_EVENT_ACTOR_TYPES).includes(explicit as Gw2EventActorType)) {
    return explicit as Gw2EventActorType;
  }

  return gw2EventActorType(event);
}

/** True when an event inherits the player's outgoing damage modifiers. */
export function isGw2PlayerModifierOwnedEvent(event: Partial<SimulationEventInput> | null | undefined): boolean {
  return gw2EventOwnerActorType(event) === GW2_EVENT_ACTOR_TYPES.PLAYER;
}

/**
 * Identifies effect-owned damage that must not inherit a weapon profile from
 * the cast which triggered it, using explicit actor ownership only.
 */
export function isGw2NonWeaponEffectEvent(event: Partial<SimulationEventInput> | null | undefined): boolean {
  return event?.actorType === GW2_EVENT_ACTOR_TYPES.EFFECT || event?.actorType === GW2_EVENT_ACTOR_TYPES.ENVIRONMENT;
}
