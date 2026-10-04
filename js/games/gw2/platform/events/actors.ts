// Ownership controls which effects may trigger player-only procs. It is
// intentionally independent from display-oriented source labels.
export const GW2_EVENT_ACTOR_TYPES = Object.freeze({
  PLAYER: 'player',
  SUMMON: 'summon',
  EFFECT: 'effect',
  ENVIRONMENT: 'environment',
  UNKNOWN: 'unknown'
});

// Validate ownership without allocating a new list for every damage/modifier query.
export const ACTOR_TYPES: ReadonlySet<string> = new Set(Object.values(GW2_EVENT_ACTOR_TYPES));

export type SimulationActorType = (typeof GW2_EVENT_ACTOR_TYPES)[keyof typeof GW2_EVENT_ACTOR_TYPES];
