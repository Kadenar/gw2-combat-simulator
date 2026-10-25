import { canonicalTime } from '#kernel/core/clock.js';

/** Gameplay reads eligibility and activity without access to the command cursor or transition methods. */
export interface CombatEngagementQueries {
  readonly explicit: boolean;
  readonly active: boolean;
  readonly startTime: number | null;
  readonly boundaryPending: boolean;
  hostileEffectsAllowed(at: number, inclusive?: boolean): boolean;
  preparationComplete(at?: number): boolean;
  combatMechanicsAllowed(): boolean;
}

/** One run owns boundary discovery, authored setup completion, and the exactly-once combat-start trigger. */
export function createCombatEngagement(
  { authoredMarkers = 0, inheritedStartTime }: { authoredMarkers?: number; inheritedStartTime?: number } = {},
  now: () => number = () => 0
) {
  if (authoredMarkers > 1 || (authoredMarkers > 0 && inheritedStartTime != null))
    throw new TypeError('Combat Start must have one owner.');

  if (inheritedStartTime != null && (!Number.isFinite(inheritedStartTime) || inheritedStartTime < 0))
    throw new RangeError('Combat Start must be finite and non-negative.');

  const explicit = authoredMarkers > 0 || inheritedStartTime != null;
  let startTime = inheritedStartTime == null ? null : canonicalTime(inheritedStartTime);
  let boundaryPending = authoredMarkers > 0 || (inheritedStartTime != null && inheritedStartTime > 0);
  // An inherited zero has no preparation interval; positive inherited boundaries wait for marker dispatch.
  let markerConsumed = !explicit || inheritedStartTime === 0;
  let active = false;
  let combatStartTriggered = false;

  const query: CombatEngagementQueries = Object.freeze({
    explicit,
    get active() {
      return active;
    },
    get startTime() {
      return startTime;
    },
    get boundaryPending() {
      return boundaryPending;
    },
    // Hostile packets at the known marker time can land before the marker command is consumed.
    hostileEffectsAllowed(at: number, inclusive = true) {
      return (
        !boundaryPending &&
        (startTime == null || (inclusive ? canonicalTime(at) >= startTime : canonicalTime(at) > startTime))
      );
    },
    preparationComplete(at = now()) {
      return !explicit || (markerConsumed && query.hostileEffectsAllowed(at));
    },
    // Gate live autonomous and reactive mechanics at the runtime clock; implicit companions may initiate combat.
    combatMechanicsAllowed() {
      return !explicit || (active && query.preparationComplete());
    }
  });

  return Object.freeze({
    query,
    discoverBoundary(at: number) {
      if (!boundaryPending || !authoredMarkers) return;

      startTime = canonicalTime(at);
      boundaryPending = false;
    },
    consumeMarker(at: number) {
      startTime = canonicalTime(at);
      boundaryPending = false;
      markerConsumed = true;
    },
    dispatchMarker(at: number) {
      // Inherited markers have no command-consumption step, so dispatch completes their setup.
      if (explicit && !markerConsumed) {
        startTime = canonicalTime(at);
        markerConsumed = true;
      }

      boundaryPending = false;
    },
    acceptEntry(at: number, marker = false): boolean {
      // Once entry has triggered combat start, later packets need no further transition checks.
      if (active && combatStartTriggered) return false;

      if (!query.hostileEffectsAllowed(at)) return false;

      active = true;

      if (combatStartTriggered || (explicit && !marker)) return false;

      combatStartTriggered = true;
      return true;
    }
  });
}

export type CombatEngagement = ReturnType<typeof createCombatEngagement>;

/** Preparation gates autonomous producers, while implicit combat lets companions initiate the fight. */
export function autonomousActionsAllowed(runtime: {
  readonly deathTime: number | null;
  readonly engagement: CombatEngagementQueries;
}): boolean {
  return runtime.deathTime == null && runtime.engagement.combatMechanicsAllowed();
}
