import { ACTOR, type SimulationActorType } from '#gw2/platform/constants.js';
import { ACTOR_TYPES } from '#gw2/platform/events/actors.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';

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
