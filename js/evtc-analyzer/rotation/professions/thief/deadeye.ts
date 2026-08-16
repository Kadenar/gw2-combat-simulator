import { EVTC_STATE_CHANGE } from "../../../types.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import {
  ASSASSINS_SIGNET,
  ASSASSINS_SIGNET_ACTIVE_BUFF,
  canonicalAction,
  combatStart,
  hasRecordedAction,
  hasSelectedSkill,
  SIGNAL_WINDOW_MS,
} from "./shared.js";

const STEAL_TIME = Object.freeze({ name: "Steal Time", skillId: 42863 });
const DEADEYES_MARK = Object.freeze({
  name: "Deadeye's Mark",
  skillId: 43390,
});
const KNEEL = Object.freeze({ name: "Kneel", skillId: 40600 });
const MERCY = Object.freeze({ name: "Mercy", skillId: 41372 });
const SHADOW_SWAP = Object.freeze({ name: "Shadow Swap", skillId: 45672 });
const SHADOW_FLARE = Object.freeze({ name: "Shadow Flare", skillId: 41158 });
const SHADOW_MELD = Object.freeze({ name: "Shadow Meld", skillId: 45508 });

const DEADEYES_GAZE_BUFF = 46333;
const KNEELING_BUFF = 42869;
const SHADOW_FLARE_RETURN_BUFF = 42774;
const RELIC_OF_THE_DEADEYE_BUFF = 70282;
const MARK_REFRESH_MERCY_THRESHOLD_MS = 12_000;
const MERCY_SIGNAL_LOOKBACK_MS = 2_500;

function deadeyeMechanicActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  const inferred: EvtcRecordedRotationAction[] = [];
  const consumedRelicEventIndexes = new Set<number>();
  const gazeEvents = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === DEADEYES_GAZE_BUFF &&
        event.buff !== 0 &&
        event.buffRemove === 0 &&
        (event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ||
          event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY),
    );
  for (const { event, eventIndex } of gazeEvents) {
    const initial = event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL;
    const start = initial
      ? Math.min(event.time, atCombat ?? event.time) - 2
      : event.time;
    inferred.push({
      ...canonicalAction(
        initial ? -3 : eventIndex,
        start,
        DEADEYES_MARK,
        event.skillId,
        initial ? "initial-state" : "buff-transition",
      ),
      ...(initial ? { precast: true } : {}),
    });

    if (initial) continue;
    const refresh = context.log.events.find(
      (candidate) =>
        candidate.skillId === DEADEYES_GAZE_BUFF &&
        candidate.time === event.time &&
        candidate.buff !== 0 &&
        candidate.buffRemove === 2 &&
        candidate.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE &&
        Math.max(candidate.value, candidate.buffDamage) >=
          MARK_REFRESH_MERCY_THRESHOLD_MS,
    );
    if (!refresh) continue;
    const relic = context.log.events
      .map((candidate, candidateIndex) => ({
        event: candidate,
        eventIndex: candidateIndex,
      }))
      .filter(
        ({ event: candidate }) =>
          candidate.source === context.playerAddress &&
          candidate.skillId === RELIC_OF_THE_DEADEYE_BUFF &&
          candidate.buff !== 0 &&
          candidate.buffRemove === 2 &&
          candidate.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE &&
          candidate.time <= event.time &&
          event.time - candidate.time <= MERCY_SIGNAL_LOOKBACK_MS,
      )
      .at(-1);
    if (relic) consumedRelicEventIndexes.add(relic.eventIndex);
    let mercyTime = relic?.event.time ?? event.time - 1;
    const nearbySignet = actions.find(
      (action) =>
        (action.rawSkillId === ASSASSINS_SIGNET_ACTIVE_BUFF ||
          action.canonicalSkillId === ASSASSINS_SIGNET.skillId) &&
        action.start <= mercyTime &&
        mercyTime - action.start <= SIGNAL_WINDOW_MS,
    );
    if (nearbySignet) {
      mercyTime = nearbySignet.start - 1;
    } else if (event.time - mercyTime <= SIGNAL_WINDOW_MS) {
      const precedingSteal = actions
        .filter(
          (action) =>
            (action.rawSkillId === STEAL_TIME.skillId ||
              action.canonicalName === STEAL_TIME.name ||
              action.rawName === STEAL_TIME.name) &&
            action.start < mercyTime &&
            mercyTime - action.start <= 700,
        )
        .at(-1);
      if (precedingSteal) mercyTime = precedingSteal.start - 1;
    }
    if (!hasRecordedAction([...actions, ...inferred], MERCY, mercyTime)) {
      inferred.push(
        canonicalAction(
          relic?.eventIndex ?? eventIndex - 0.1,
          mercyTime,
          MERCY,
          RELIC_OF_THE_DEADEYE_BUFF,
        ),
      );
    }
  }

  if (hasSelectedSkill(context, MERCY)) {
    context.log.events.forEach((event, eventIndex) => {
      if (
        consumedRelicEventIndexes.has(eventIndex) ||
        event.source !== context.playerAddress ||
        event.skillId !== RELIC_OF_THE_DEADEYE_BUFF ||
        event.buff === 0 ||
        event.buffRemove !== 2 ||
        event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE ||
        hasRecordedAction([...actions, ...inferred], MERCY, event.time)
      ) {
        return;
      }
      const knownCantrip = [SHADOW_FLARE, SHADOW_MELD].some((identity) =>
        actions.some(
          (action) =>
            (action.rawSkillId === identity.skillId ||
              action.canonicalSkillId === identity.skillId) &&
            (Math.abs(action.start - event.time) <= SIGNAL_WINDOW_MS ||
              Math.abs(action.end - event.time) <= SIGNAL_WINDOW_MS),
        ),
      );
      if (!knownCantrip) {
        inferred.push(
          canonicalAction(eventIndex, event.time, MERCY, event.skillId),
        );
      }
    });
  }

  const kneeling = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === KNEELING_BUFF &&
        event.buff !== 0 &&
        event.buffRemove === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
    );
  if (kneeling && !hasRecordedAction(actions, KNEEL, kneeling.event.time)) {
    const start = Math.min(
      kneeling.event.time,
      atCombat ?? kneeling.event.time,
    );
    inferred.push({
      ...canonicalAction(
        -2,
        start - 1,
        KNEEL,
        kneeling.event.skillId,
        "initial-state",
      ),
      precast: true,
    });
  }

  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== SHADOW_FLARE_RETURN_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 3 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE ||
      hasRecordedAction([...actions, ...inferred], SHADOW_SWAP, event.time)
    ) {
      return;
    }
    inferred.push(
      canonicalAction(eventIndex, event.time, SHADOW_SWAP, event.skillId),
    );
  });
  return inferred;
}

export function reconstructDeadeyeActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return [...actions, ...deadeyeMechanicActions(context, actions)];
}
