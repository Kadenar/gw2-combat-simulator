import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import {
  combatStart,
  hasActionNear,
  initialAction,
  instantAction,
  isBuffApplication,
  recordedDuration,
} from "./shared.js";

const BERSERK = Object.freeze({ name: "Berserk", skillId: 30185 });
const OUTRAGE = Object.freeze({ name: "Outrage", skillId: 30258 });
const HEAD_BUTT = Object.freeze({ name: "Head Butt", skillId: 30343 });
const BERSERK_BUFF = 29502;
const BERSERK_ENTRY_DURATION_MS = 20_000;
const OUTRAGE_EXTENSION_MS = 3_000;
const OPENING_WINDOW_MS = 1_000;

function berserkEntryActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== BERSERK_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      !isBuffApplication(event.stateChange) ||
      Math.max(event.value, event.buffDamage) < BERSERK_ENTRY_DURATION_MS ||
      hasActionNear(actions, BERSERK, event.time)
    ) {
      return [];
    }
    return [
      instantAction(
        eventIndex,
        event.time,
        event.skillId,
        "Berserk",
        BERSERK,
        "buff-transition",
      ),
    ];
  });
}

function outrageActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.target !== context.playerAddress ||
      event.source === context.playerAddress ||
      event.skillId !== BERSERK_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      !isBuffApplication(event.stateChange) ||
      Math.max(event.value, event.buffDamage) !== OUTRAGE_EXTENSION_MS ||
      hasActionNear(actions, OUTRAGE, event.time)
    ) {
      return [];
    }
    const precedingSwap = actions
      .filter(
        (action) =>
          action.rawName === "Swap Weapons" &&
          action.start <= event.time &&
          event.time - action.start <= 150,
      )
      .sort((left, right) => right.start - left.start)[0];
    const time = precedingSwap ? precedingSwap.start - 1 : event.time - 1;
    return [
      instantAction(
        eventIndex,
        time,
        event.skillId,
        "Berserk extension",
        OUTRAGE,
        "buff-transition",
      ),
    ];
  });
}

function openingPrecasts(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  entries: readonly EvtcRecordedRotationAction[],
  outrages: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  const firstEntry = [...entries].sort(
    (left, right) => left.start - right.start,
  )[0];
  const headButtEquipped =
    actions.some(
      (action) =>
        action.rawSkillId === HEAD_BUTT.skillId ||
        action.rawName === HEAD_BUTT.name,
    ) || context.selectedSkillNames?.includes(HEAD_BUTT.name);
  if (
    atCombat == null ||
    !firstEntry ||
    firstEntry.start < atCombat ||
    firstEntry.start - atCombat > OPENING_WINDOW_MS ||
    !headButtEquipped
  ) {
    return [];
  }

  const headButtDuration = recordedDuration(context, HEAD_BUTT);
  const inferred: EvtcRecordedRotationAction[] = [];
  if (!hasActionNear(actions, HEAD_BUTT, atCombat, headButtDuration + 50)) {
    inferred.push(
      initialAction(
        context,
        HEAD_BUTT,
        atCombat - headButtDuration,
        firstEntry.eventIndex - 2,
      ),
    );
  }
  if (
    outrages.length > 0 &&
    !hasActionNear(actions, OUTRAGE, atCombat, OPENING_WINDOW_MS)
  ) {
    inferred.push({
      ...instantAction(
        firstEntry.eventIndex - 1,
        atCombat,
        BERSERK_BUFF,
        "Opening stunbreak",
        OUTRAGE,
        "initial-state",
      ),
      precast: true,
    });
  }
  return inferred;
}

export function reconstructBerserkerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const entries = berserkEntryActions(context, actions);
  const outrages = outrageActions(context, actions);
  return [
    ...openingPrecasts(context, actions, entries, outrages),
    ...actions,
    ...entries,
    ...outrages,
  ];
}
