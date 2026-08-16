import { EVTC_STATE_CHANGE } from "../../types.js";
import { reconstructEvokerActions } from "./elementalist/evoker.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

const FIRE_ATTUNEMENT_ID = 1100001;
const ELEMENTAL_COMMANDS = Object.freeze([
  {
    speciesId: 6524,
    character: "Fire Elemental",
    action: { name: "Flame Barrage", skillId: 2662 },
  },
  {
    speciesId: 6523,
    character: "Earth Elemental",
    action: { name: "Stomp", skillId: 2666 },
  },
]);

type ElementalistActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
) => EvtcRecordedRotationAction[];

const specializationAnalyzers: ReadonlyMap<
  string,
  ElementalistActionTransform
> = new Map([["evoker", reconstructEvokerActions]]);

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

function ownedElementalCommandActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  return ELEMENTAL_COMMANDS.flatMap(({ speciesId, character, action }) => {
    const actors = new Set(
      context.log.agents
        .filter(
          (agent) =>
            agent.profession === speciesId || agent.character === character,
        )
        .map((agent) => agent.address),
    );
    const starts = context.log.events.filter(
      (event) =>
        actors.has(event.source) &&
        event.sourceMasterInstance === ownerInstance &&
        event.skillId === action.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START,
    );

    return context.log.events.flatMap((event, eventIndex) => {
      if (
        !actors.has(event.source) ||
        event.sourceMasterInstance !== ownerInstance ||
        event.skillId !== action.skillId
      ) {
        return [];
      }
      const directStart =
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START;
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
          rawName: action.name,
          canonicalSkillId: action.skillId,
          canonicalName: action.name,
          evidence: "animation" as const,
          status: "instant" as const,
          eventIndex,
          ...(unmatchedStop ? { precast: true } : {}),
        },
      ];
    });
  });
}

export function reconstructElementalistProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  let actions = context.recordedActions.filter(
    (action) =>
      !(
        action.initialState === true &&
        (action.rawSkillId === FIRE_ATTUNEMENT_ID ||
          action.canonicalSkillId === FIRE_ATTUNEMENT_ID)
      ),
  );
  actions =
    specializationAnalyzers.get(context.profile.specializationId)?.(
      context,
      actions,
    ) || actions;
  return [...actions, ...ownedElementalCommandActions(context)].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
}
