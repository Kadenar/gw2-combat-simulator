import { EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { canonicalAction, hasRecordedAction, SIGNAL_WINDOW_MS } from './shared.js';

const STEAL = Object.freeze({ name: 'Steal', skillId: 13014 });
const VIGOR_BUFF = 726;
const MIGHT_BUFF = 740;
const DAREDEVIL_DODGE_ANIMATION = 23275;

function pairedDaredevilDodgeActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const starts: Array<{
    readonly time: number;
    readonly eventIndex: number;
  }> = [];
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (event.source !== context.playerAddress || event.skillId !== DAREDEVIL_DODGE_ANIMATION) {
      return;
    }

    if (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START) {
      starts.push({ time: event.time, eventIndex });
      return;
    }

    if (event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP) return;
    const start = starts.shift();
    if (!start || event.time < start.time) return;
    const duration = event.time - start.time;
    actions.push({
      ...canonicalAction(
        start.eventIndex,
        start.time,
        {
          name: context.profile.dodge.name,
          skillId: Number(context.profile.dodge.skillId)
        },
        event.skillId,
        'animation'
      ),
      end: event.time,
      expectedDuration: duration,
      status: 'completed'
    });
  });
  return actions;
}

function daredevilStealActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const events = context.log.events;
  return events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== VIGOR_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      hasRecordedAction(actions, STEAL, event.time)
    ) {
      return [];
    }

    const mightPackets = events.filter(
      (candidate) =>
        candidate.source === context.playerAddress &&
        candidate.target === context.playerAddress &&
        candidate.skillId === MIGHT_BUFF &&
        candidate.buff !== 0 &&
        candidate.buffRemove === 0 &&
        candidate.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY &&
        Math.abs(candidate.time - event.time) <= SIGNAL_WINDOW_MS
    ).length;
    if (mightPackets < 5) return [];
    return [canonicalAction(eventIndex, event.time, STEAL, event.skillId)];
  });
}

export function reconstructDaredevilActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const withDodges = [...actions, ...pairedDaredevilDodgeActions(context)];
  return [...withDodges, ...daredevilStealActions(context, withDodges)];
}
