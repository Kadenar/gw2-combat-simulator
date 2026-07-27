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

const EFFECT_SOURCES = new Set([
  "Food",
  "Relic",
  "Sigil",
  "Trait",
]);

/**
 * Classifies legacy source labels while new events migrate to actorType.
 */
export function gw2ActorTypeForSource(source) {
  if (source === "Player") return GW2_EVENT_ACTOR_TYPES.PLAYER;
  if (SUMMON_SOURCES.has(source)) return GW2_EVENT_ACTOR_TYPES.SUMMON;
  if (EFFECT_SOURCES.has(source)) return GW2_EVENT_ACTOR_TYPES.EFFECT;
  return GW2_EVENT_ACTOR_TYPES.UNKNOWN;
}

export function gw2EventActorType(event) {
  const explicit = String(event?.actorType || "");
  // Explicit canonical ownership is authoritative. Source inference is only a
  // compatibility fallback for events created before actorType was required.
  if (Object.values(GW2_EVENT_ACTOR_TYPES).includes(explicit)) return explicit;
  return gw2ActorTypeForSource(event?.source);
}

export function isGw2PlayerActorEvent(event) {
  // UNKNOWN is conservative: unclassified effects must not trigger player-only
  // sigils, food, or profession hit rules.
  return gw2EventActorType(event) === GW2_EVENT_ACTOR_TYPES.PLAYER;
}
