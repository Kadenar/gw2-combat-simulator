import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { EVTC_STATE_CHANGE } from '../../../types.js';
import {
  combatStart,
  hasActionNear,
  initialAction,
  instantAction,
  isBuffApplication,
  playerInitialBuff,
  recordedDuration,
  SIGNAL_WINDOW_MS,
  skillFor
} from './shared.js';

const BERSERK = Object.freeze({ name: 'Berserk', skillId: 30185 });
const OUTRAGE = Object.freeze({ name: 'Outrage', skillId: 30258 });
const HEAD_BUTT = Object.freeze({ name: 'Head Butt', skillId: 30343 });
const FLAMES_OF_WAR = Object.freeze({ name: 'Flames of War', skillId: 29940 });
const SWAP_WEAPONS = Object.freeze({ name: 'Swap Weapons', skillId: -3 });
const BERSERK_BUFF = 29502;
const FLAMES_OF_WAR_BUFF = 31708;
const BERSERK_ENTRY_DURATION_MS = 20_000;
const OUTRAGE_EXTENSION_MS = 3_000;
const OPENING_WINDOW_MS = 1_000;

function berserkEntryActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
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
    return [instantAction(eventIndex, event.time, event.skillId, 'Berserk', BERSERK, 'buff-transition')];
  });
}

function outrageActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const durationChanges = context.log.events.flatMap((event, eventIndex) => {
    const supportedStateChange =
      isBuffApplication(event.stateChange) || event.stateChange === EVTC_STATE_CHANGE.BUFF_CHANGE;
    return event.target === context.playerAddress &&
      event.source !== context.playerAddress &&
      event.skillId === BERSERK_BUFF &&
      event.buff !== 0 &&
      event.buffRemove === 0 &&
      supportedStateChange &&
      Math.max(event.value, event.buffDamage) > 0
      ? [{ event, eventIndex }]
      : [];
  });
  // Rage skills can emit the same three-second duration change as Outrage.
  // Consume one nearby signal per recorded Rage cast before inferring instants.
  const claimedDurationChanges = new Set<number>();
  const recordedRageActions = actions
    .filter((action) => {
      const skill = skillFor(context, {
        name: action.canonicalName ?? action.rawName,
        skillId: Number(action.canonicalSkillId ?? action.rawSkillId)
      });
      return skill?.categories?.some((category) => category.trim().toLowerCase() === 'rage');
    })
    .sort((left, right) => left.end - right.end);
  for (const action of recordedRageActions) {
    const matchingChange = durationChanges
      .filter(
        ({ event, eventIndex }) =>
          !claimedDurationChanges.has(eventIndex) && Math.abs(event.time - action.end) <= SIGNAL_WINDOW_MS
      )
      .sort(
        (left, right) =>
          Math.abs(left.event.time - action.end) - Math.abs(right.event.time - action.end) ||
          Number(Math.max(left.event.value, left.event.buffDamage) === OUTRAGE_EXTENSION_MS) -
            Number(Math.max(right.event.value, right.event.buffDamage) === OUTRAGE_EXTENSION_MS) ||
          left.eventIndex - right.eventIndex
      )[0];
    if (matchingChange) claimedDurationChanges.add(matchingChange.eventIndex);
  }

  return durationChanges.flatMap(({ event, eventIndex }) => {
    if (
      claimedDurationChanges.has(eventIndex) ||
      Math.max(event.value, event.buffDamage) !== OUTRAGE_EXTENSION_MS ||
      hasActionNear(actions, OUTRAGE, event.time)
    ) {
      return [];
    }
    const precedingSwap = actions
      .filter(
        (action) => action.rawName === 'Swap Weapons' && action.start <= event.time && event.time - action.start <= 150
      )
      .sort((left, right) => right.start - left.start)[0];
    const time = precedingSwap ? precedingSwap.start - 1 : event.time - 1;
    return [instantAction(eventIndex, time, event.skillId, 'Berserk extension', OUTRAGE, 'buff-transition')];
  });
}

function openingPrecasts(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  entries: readonly EvtcRecordedRotationAction[],
  outrages: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  const firstEntry = [...entries].sort((left, right) => left.start - right.start)[0];
  const headButtEquipped =
    actions.some((action) => action.rawSkillId === HEAD_BUTT.skillId || action.rawName === HEAD_BUTT.name) ||
    context.selectedSkillNames?.includes(HEAD_BUTT.name);
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
  const recordedHeadButt = actions
    .filter(
      (action) =>
        (action.rawSkillId === HEAD_BUTT.skillId ||
          action.canonicalSkillId === HEAD_BUTT.skillId ||
          action.rawName.trim().toLowerCase() === HEAD_BUTT.name.toLowerCase() ||
          action.canonicalName?.trim().toLowerCase() === HEAD_BUTT.name.toLowerCase()) &&
        Math.abs(action.end - atCombat) <= headButtDuration + 50
    )
    .sort((left, right) => Math.abs(left.end - atCombat) - Math.abs(right.end - atCombat))[0];
  const headButtStart = recordedHeadButt?.start ?? atCombat - headButtDuration;
  const inferred: EvtcRecordedRotationAction[] = [];
  if (
    playerInitialBuff(context, FLAMES_OF_WAR_BUFF) &&
    !actions.some(
      (action) =>
        (action.rawSkillId === FLAMES_OF_WAR.skillId || action.canonicalSkillId === FLAMES_OF_WAR.skillId) &&
        action.start <= atCombat
    )
  ) {
    const flamesDuration = recordedDuration(context, FLAMES_OF_WAR);
    inferred.push(initialAction(context, FLAMES_OF_WAR, headButtStart - flamesDuration, firstEntry.eventIndex - 4));
    if (!hasActionNear(actions, SWAP_WEAPONS, headButtStart)) {
      inferred.push({
        ...instantAction(
          firstEntry.eventIndex - 3,
          headButtStart,
          0,
          'Opening weapon swap',
          SWAP_WEAPONS,
          'initial-state'
        ),
        precast: true
      });
    }
  }
  if (!recordedHeadButt) {
    inferred.push(initialAction(context, HEAD_BUTT, headButtStart, firstEntry.eventIndex - 2));
  }
  if (outrages.length > 0 && !hasActionNear(actions, OUTRAGE, atCombat, OPENING_WINDOW_MS)) {
    inferred.push({
      ...instantAction(
        firstEntry.eventIndex - 1,
        atCombat,
        BERSERK_BUFF,
        'Opening stunbreak',
        OUTRAGE,
        'initial-state'
      ),
      precast: true
    });
  }
  return inferred;
}

export function reconstructBerserkerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const entries = berserkEntryActions(context, actions);
  const outrages = outrageActions(context, actions);
  return [...openingPrecasts(context, actions, entries, outrages), ...actions, ...entries, ...outrages];
}
