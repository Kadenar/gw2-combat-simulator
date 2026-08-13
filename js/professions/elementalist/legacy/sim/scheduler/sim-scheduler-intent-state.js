import { enqueueOrdered } from "../../../../../platform/engine/event-queue.js";
import {
  buildFreshAirHitCandidate,
  isFreshAirEligibleHitEvent,
} from "../mechanics/sim-fresh-air-state.js";

export function createSchedulerIntentState() {
  return {
    acceptingLookaheadIntents: true,
    freshAirHitIntents: [],
  };
}

export function getSchedulerIntentState(S) {
  if (!S.schedulerIntentState) {
    S.schedulerIntentState = createSchedulerIntentState();
  }
  return S.schedulerIntentState;
}

export function peekSchedulerIntentState(S) {
  return S?.schedulerIntentState || null;
}

export function disableSchedulerLookaheadIntents(S) {
  const intentState = peekSchedulerIntentState(S);
  if (!intentState) return false;
  intentState.acceptingLookaheadIntents = false;
  return false;
}

export function isFreshAirLookaheadEligibleHit(hitEvent) {
  return isFreshAirEligibleHitEvent(hitEvent);
}

export function queueFreshAirHitIntent(intentState, hitEvent) {
  if (!intentState?.acceptingLookaheadIntents) return null;
  if (!isFreshAirLookaheadEligibleHit(hitEvent)) return null;

  const intent = buildFreshAirHitCandidate(hitEvent);
  enqueueOrdered(intentState.freshAirHitIntents, intent);
  return intent;
}
