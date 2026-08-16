import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from "../../../types.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import { directAction, firstPlayerEventTime, rangerSkill } from "./shared.js";

const BARRAGE = Object.freeze({ name: "Barrage", skillId: 12469 });
const SUMMON_CYCLONE_BOW = Object.freeze({
  name: "Summon Cyclone Bow",
  skillId: 76787,
});
const DISMISS_CYCLONE_BOW = Object.freeze({
  name: "Dismiss Cyclone Bow",
  skillId: 77213,
});

const CYCLONE_BOW_WEAPON_SET = 2;
const TRUNCATED_CAST_WINDOW_MS = 150;
const CYCLONE_BOW_SKILL_IDS = new Set([
  76664, // Hawkeye
  76722, // Pelt
  76807, // Quarry's Peril
  77012, // Fleeting Zephyr
  77174, // Supersonic Arrow
  77183, // Keen Shot
  77319, // Bluster
]);
const GALESHOT_FALSE_INTERRUPTION_IDS = new Set([
  76757, // Mistral
  76979, // Perfect Storm
  77319, // Bluster
]);

function truncatedBarrageActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const firstEventTime = firstPlayerEventTime(context);
  if (firstEventTime == null) return [];

  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== BARRAGE.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE &&
        event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }
    const start = event.time - event.value;
    const alreadyRecorded = actions.some(
      (action) =>
        action.rawSkillId === event.skillId &&
        Math.abs(action.end - event.time) <= TRUNCATED_CAST_WINDOW_MS,
    );
    if (alreadyRecorded || start >= firstEventTime) return [];
    return [
      {
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          BARRAGE.name,
          BARRAGE,
          "initial-state",
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: "completed" as const,
        precast: true,
      },
    ];
  });
}

function normalizeFalseInterruptions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return actions.map((action) => {
    if (
      action.status !== "interrupted" ||
      action.end !== action.start ||
      !GALESHOT_FALSE_INTERRUPTION_IDS.has(action.rawSkillId)
    ) {
      return action;
    }
    const skill = rangerSkill(context, action.rawSkillId, action.rawName);
    const duration = Math.max(
      0,
      Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
    );
    if (duration <= 0) return action;
    return {
      ...action,
      end: action.start + duration,
      expectedDuration: duration,
      status: "completed",
    };
  });
}

function cycloneBowActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const mapped = actions.map((action) => {
    if (action.rawName !== "Swap Weapons") return action;
    const rawEvent = context.log.events[action.eventIndex];
    const identity =
      action.weaponSet === CYCLONE_BOW_WEAPON_SET
        ? SUMMON_CYCLONE_BOW
        : Number(rawEvent?.value) === CYCLONE_BOW_WEAPON_SET
          ? DISMISS_CYCLONE_BOW
          : null;
    if (!identity) return action;
    return {
      ...action,
      rawName: identity.name,
      canonicalSkillId: identity.skillId,
      canonicalName: identity.name,
    };
  });

  const swaps = actions
    .filter((action) => action.rawName === "Swap Weapons")
    .sort(
      (left, right) =>
        left.start - right.start || left.eventIndex - right.eventIndex,
    );
  const firstSwap = swaps[0];
  const startsInCycloneBow =
    firstSwap != null &&
    (Number(context.log.events[firstSwap.eventIndex]?.value) ===
      CYCLONE_BOW_WEAPON_SET ||
      actions.some(
        (action) =>
          CYCLONE_BOW_SKILL_IDS.has(action.rawSkillId) &&
          action.start < firstSwap.start,
      ));
  if (!startsInCycloneBow) return mapped;

  const firstAction = [...mapped].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  )[0];
  if (!firstAction) return mapped;
  return [
    ...mapped,
    directAction(
      firstAction.eventIndex + 0.5,
      firstAction.start,
      0,
      SUMMON_CYCLONE_BOW.name,
      SUMMON_CYCLONE_BOW,
      "initial-state",
      { weaponSet: CYCLONE_BOW_WEAPON_SET, precast: true },
    ),
  ];
}

export function reconstructGaleshotActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const barrage = truncatedBarrageActions(context, recordedActions);
  const actions = normalizeFalseInterruptions(context, [
    ...recordedActions,
    ...barrage,
  ]);
  return cycloneBowActions(context, actions);
}
