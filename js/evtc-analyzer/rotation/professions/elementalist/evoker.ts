import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtcEvent } from '../../../types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../../professions/elementalist/data/ids.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';

const EVOKER_SKILL_ALIASES = new Map([
  [76925, { name: 'Calcify', skillId: ID.CALCIFY }],
  [76707, { name: 'Seismic Impact', skillId: ID.SEISMIC_IMPACT }],
  [77247, { name: "Toad's Fortitude", skillId: ID.TOADS_FORTITUDE }]
]);
const CALCIFY_RAW_SKILL_ID = 76925;
const CALCIFY = Object.freeze({ name: 'Calcify', skillId: ID.CALCIFY });

function playerInstance(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find((event) => event.source === context.playerAddress && event.sourceInstance > 0)
      ?.sourceInstance ?? null
  );
}

function calcifyEffectCommitted(context: EvtcProfessionReconstructionContext, start: number, end: number): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === CALCIFY_RAW_SKILL_ID &&
      event.time >= start &&
      event.time <= end &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === EVTC_ACTIVATION.NONE &&
      event.buff === 0 &&
      event.value > 0 &&
      event.target !== 0n
  );
}

function matchingCalcifyStop(
  start: ParsedEvtcEvent,
  stops: readonly { readonly event: ParsedEvtcEvent; readonly eventIndex: number }[],
  matchedStopIndexes: ReadonlySet<number>
): { readonly event: ParsedEvtcEvent; readonly eventIndex: number } | null {
  return (
    stops.find(
      ({ event, eventIndex }) =>
        !matchedStopIndexes.has(eventIndex) &&
        event.source === start.source &&
        event.time > start.time &&
        Math.abs(event.time - start.time - event.value) <= 150
    ) ?? null
  );
}

function calcifyAction(
  event: ParsedEvtcEvent,
  eventIndex: number,
  start: number,
  precast = false
): EvtcRecordedRotationAction {
  return {
    start,
    end: start,
    expectedDuration: 0,
    rawSkillId: event.skillId,
    rawName: CALCIFY.name,
    canonicalSkillId: CALCIFY.skillId,
    canonicalName: CALCIFY.name,
    evidence: 'animation',
    status: 'instant',
    eventIndex,
    ...(precast ? { precast: true } : {})
  };
}

function calcifyActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const ownedEvents = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(({ event }) => event.sourceMasterInstance === ownerInstance && event.skillId === CALCIFY_RAW_SKILL_ID);
  const starts = ownedEvents.filter(({ event }) => event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START);
  const stops = ownedEvents.filter(
    ({ event }) => event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP && event.value > 0
  );
  const matchedStopIndexes = new Set<number>();
  const actions = starts.flatMap(({ event, eventIndex }) => {
    const stop = matchingCalcifyStop(event, stops, matchedStopIndexes);
    if (stop) matchedStopIndexes.add(stop.eventIndex);
    // Seismic Impact can cancel the familiar's visual animation after Calcify
    // committed; keep that input, but do not replay an uncommitted cancellation.
    if (
      stop?.event.activation === EVTC_ACTIVATION.CANCEL_CANCEL &&
      !calcifyEffectCommitted(context, event.time, stop.event.time)
    ) {
      return [];
    }

    return [calcifyAction(event, eventIndex, event.time)];
  });

  for (const { event, eventIndex } of stops) {
    if (matchedStopIndexes.has(eventIndex)) continue;
    const start = event.time - event.value;
    if (event.activation === EVTC_ACTIVATION.CANCEL_CANCEL && !calcifyEffectCommitted(context, start, event.time)) {
      continue;
    }

    actions.push(calcifyAction(event, eventIndex, start, true));
  }

  return actions;
}

/** Normalizes Evoker-only ArcDPS skill IDs into simulator skill identities. */
export function reconstructEvokerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const normalized = actions.map((action) => {
    const identity = EVOKER_SKILL_ALIASES.get(action.rawSkillId);
    if (!identity) return action;
    return {
      ...action,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name
    };
  });
  return [...normalized, ...calcifyActions(context)].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
