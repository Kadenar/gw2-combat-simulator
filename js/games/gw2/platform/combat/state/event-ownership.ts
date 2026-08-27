import type { SimulationEventInput } from '../../engine/types.js';

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

const SUMMON_SOURCES = new Set(['Clone', 'Phantasm', 'Pet', 'Minion', 'Turret']);

const EFFECT_SOURCES = new Set(['Food', 'Relic', 'Sigil', 'Trait']);
const NON_WEAPON_EFFECT_SOURCES = new Set(['equipment', 'food', 'relic', 'sigil', 'trait']);

/**
 * Classifies display-oriented source labels when explicit actor ownership is absent.
 *
 * @param {unknown} source
 * @returns {Gw2EventActorType}
 */
export function gw2ActorTypeForSource(source: unknown): Gw2EventActorType {
  if (source === 'Player') return GW2_EVENT_ACTOR_TYPES.PLAYER;
  if (source === 'Environment') return GW2_EVENT_ACTOR_TYPES.ENVIRONMENT;
  if (typeof source === 'string' && SUMMON_SOURCES.has(source)) {
    return GW2_EVENT_ACTOR_TYPES.SUMMON;
  }

  if (typeof source === 'string' && EFFECT_SOURCES.has(source)) {
    return GW2_EVENT_ACTOR_TYPES.EFFECT;
  }

  return GW2_EVENT_ACTOR_TYPES.UNKNOWN;
}

/**
 * @param {Partial<SimulationEventInput> | null | undefined} event
 * @returns {Gw2EventActorType}
 */
export function gw2EventActorType(event: Partial<SimulationEventInput> | null | undefined): Gw2EventActorType {
  const explicit = String(event?.actorType || '');
  // Explicit canonical ownership is authoritative. Source inference is only a
  // compatibility fallback for events created before actorType was required.
  if (Object.values(GW2_EVENT_ACTOR_TYPES).includes(explicit as Gw2EventActorType)) {
    return explicit as Gw2EventActorType;
  }

  return gw2ActorTypeForSource(event?.source);
}

/** @param {Partial<SimulationEventInput> | null | undefined} event */
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
 * Preserves profession-modifier compatibility for legacy effect packets that
 * predate ownerActorType. An explicit owner always remains authoritative.
 */
export function isGw2PlayerModifierEligibleEvent(event: Partial<SimulationEventInput> | null | undefined): boolean {
  if (event?.ownerActorType != null) return isGw2PlayerModifierOwnedEvent(event);
  return isGw2PlayerModifierOwnedEvent(event) || gw2EventActorType(event) === GW2_EVENT_ACTOR_TYPES.EFFECT;
}

/**
 * Identifies effect-owned damage that must not inherit a weapon profile from
 * the cast which triggered it. Source matching preserves compatibility for
 * older events without canonical actor ownership.
 */
export function isGw2NonWeaponEffectEvent(event: Partial<SimulationEventInput> | null | undefined): boolean {
  return (
    event?.actorType === GW2_EVENT_ACTOR_TYPES.EFFECT ||
    event?.actorType === GW2_EVENT_ACTOR_TYPES.ENVIRONMENT ||
    NON_WEAPON_EFFECT_SOURCES.has(String(event?.source || '').toLowerCase())
  );
}
