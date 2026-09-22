import { ACTOR_TYPES, GW2_EVENT_ACTOR_TYPES } from '#gw2/platform/engine/events/actors.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';

/** Reads explicit ownership; absent query events remain unknown and display labels never determine actors. */
export function gw2EventActorType(event: Partial<SimulationEventBase> | null | undefined): SimulationActorType {
  const explicit = String(event?.actorType || '');
  if (ACTOR_TYPES.has(explicit)) {
    return explicit as SimulationActorType;
  }

  return GW2_EVENT_ACTOR_TYPES.UNKNOWN;
}

export function isGw2PlayerActorEvent(event: Partial<SimulationEventBase> | null | undefined): boolean {
  // UNKNOWN is conservative: unclassified effects must not trigger player-only
  // sigils, food, or profession hit rules.
  return gw2EventActorType(event) === GW2_EVENT_ACTOR_TYPES.PLAYER;
}

/**
 * Resolves whose outgoing modifiers an event inherits. Events without an
 * explicit owner retain their actor ownership.
 */
export function gw2EventOwnerActorType(event: Partial<SimulationEventBase> | null | undefined): SimulationActorType {
  const explicit = String(event?.ownerActorType || '');
  if (ACTOR_TYPES.has(explicit)) {
    return explicit as SimulationActorType;
  }

  return gw2EventActorType(event);
}

/** True when an event inherits the player's outgoing damage modifiers. */
export function isGw2PlayerModifierOwnedEvent(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return gw2EventOwnerActorType(event) === GW2_EVENT_ACTOR_TYPES.PLAYER;
}

/**
 * Identifies effect-owned damage that must not inherit a weapon profile from
 * the cast which triggered it, using explicit actor ownership only.
 */
export function isGw2NonWeaponEffectEvent(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return event?.actorType === GW2_EVENT_ACTOR_TYPES.EFFECT || event?.actorType === GW2_EVENT_ACTOR_TYPES.ENVIRONMENT;
}
