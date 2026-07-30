import type { SimulationEventInput } from "../engine/types.js";

export type Gw2EventActorType =
  | "player"
  | "summon"
  | "effect"
  | "unknown";

// Ownership controls which effects may trigger player-only procs. It is
// intentionally independent from display-oriented source labels.
export const GW2_EVENT_ACTOR_TYPES = Object.freeze({
  PLAYER: "player",
  SUMMON: "summon",
  EFFECT: "effect",
  UNKNOWN: "unknown",
});

const SUMMON_SOURCES = new Set([
  "Clone",
  "Phantasm",
  "Pet",
  "Minion",
  "Turret",
]);

const EFFECT_SOURCES = new Set(["Food", "Relic", "Sigil", "Trait"]);

/**
 * Classifies legacy source labels while new events migrate to actorType.
 *
 * @param {unknown} source
 * @returns {Gw2EventActorType}
 */
export function gw2ActorTypeForSource(
  source: unknown,
): Gw2EventActorType {
  if (source === "Player") return GW2_EVENT_ACTOR_TYPES.PLAYER;
  if (typeof source === "string" && SUMMON_SOURCES.has(source)) {
    return GW2_EVENT_ACTOR_TYPES.SUMMON;
  }
  if (typeof source === "string" && EFFECT_SOURCES.has(source)) {
    return GW2_EVENT_ACTOR_TYPES.EFFECT;
  }
  return GW2_EVENT_ACTOR_TYPES.UNKNOWN;
}

/**
 * @param {Partial<SimulationEventInput> | null | undefined} event
 * @returns {Gw2EventActorType}
 */
export function gw2EventActorType(
  event: Partial<SimulationEventInput> | null | undefined,
): Gw2EventActorType {
  const explicit = String(event?.actorType || "");
  // Explicit canonical ownership is authoritative. Source inference is only a
  // compatibility fallback for events created before actorType was required.
  if (
    Object.values(GW2_EVENT_ACTOR_TYPES).includes(
      explicit as Gw2EventActorType,
    )
  ) {
    return explicit as Gw2EventActorType;
  }
  return gw2ActorTypeForSource(event?.source);
}

/** @param {Partial<SimulationEventInput> | null | undefined} event */
export function isGw2PlayerActorEvent(
  event: Partial<SimulationEventInput> | null | undefined,
): boolean {
  // UNKNOWN is conservative: unclassified effects must not trigger player-only
  // sigils, food, or profession hit rules.
  return gw2EventActorType(event) === GW2_EVENT_ACTOR_TYPES.PLAYER;
}
