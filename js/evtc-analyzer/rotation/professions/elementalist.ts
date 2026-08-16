import { EVTC_STATE_CHANGE } from "../../types.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

const FIRE_ATTUNEMENT_ID = 1100001;
const EARTH_ELEMENTAL_SPECIES_ID = 6523;
const STOMP = Object.freeze({ name: "Stomp", skillId: 2666 });

function playerInstance(
  context: EvtcProfessionReconstructionContext,
): number | null {
  return (
    context.log.events.find(
      (event) =>
        event.source === context.playerAddress && event.sourceInstance > 0,
    )?.sourceInstance ?? null
  );
}

function earthElementalCommands(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const earthElementals = new Set(
    context.log.agents
      .filter(
        (agent) =>
          agent.profession === EARTH_ELEMENTAL_SPECIES_ID ||
          agent.character === "Earth Elemental",
      )
      .map((agent) => agent.address),
  );

  const starts = context.log.events.filter(
    (event) =>
      earthElementals.has(event.source) &&
      event.sourceMasterInstance === ownerInstance &&
      event.skillId === STOMP.skillId &&
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START,
  );

  return context.log.events.flatMap((event, eventIndex) => {
    if (
      !earthElementals.has(event.source) ||
      event.sourceMasterInstance !== ownerInstance ||
      event.skillId !== STOMP.skillId
    ) {
      return [];
    }
    const directStart = event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START;
    const unmatchedStop =
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
      event.value > 0 &&
      !starts.some(
        (start) =>
          start.source === event.source &&
          start.time < event.time &&
          Math.abs(event.time - start.time - event.value) <= 150,
      );
    if (!directStart && !unmatchedStop) return [];
    const start = directStart ? event.time : event.time - event.value;
    return [
      {
        start,
        end: start,
        expectedDuration: 0,
        rawSkillId: event.skillId,
        rawName: STOMP.name,
        canonicalSkillId: STOMP.skillId,
        canonicalName: STOMP.name,
        evidence: "animation" as const,
        status: "instant" as const,
        eventIndex,
        ...(unmatchedStop ? { precast: true } : {}),
      },
    ];
  });
}

export function reconstructElementalistProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const actions = context.recordedActions.filter(
    (action) =>
      !(
        action.initialState === true &&
        (action.rawSkillId === FIRE_ATTUNEMENT_ID ||
          action.canonicalSkillId === FIRE_ATTUNEMENT_ID)
      ),
  );
  return [...actions, ...earthElementalCommands(context)].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
}
