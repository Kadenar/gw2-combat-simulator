import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import { firstStrikePacketOffsetMs } from '../../effect-packets.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { canonicalAction, firstPlayerEventTime, recordedDuration, SIGNAL_WINDOW_MS, skillFor } from './shared.js';

const SWORD_OF_JUSTICE = Object.freeze({
  name: 'Sword of Justice',
  skillId: 9168
});
const RUSHING_JUSTICE = Object.freeze({
  name: 'Rushing Justice',
  skillId: 62668
});
const FLOWING_RESOLVE = Object.freeze({
  name: 'Flowing Resolve',
  skillId: 62603
});
const JURISDICTION = Object.freeze({ name: 'Jurisdiction', skillId: 71817 });

const JURISDICTION_FOLLOW_UP_ANIMATION = 71818;
const RUSHING_JUSTICE_START_ANIMATION = 62668;
const RUSHING_JUSTICE_IMPACT_ANIMATION = 62624;
const SWORD_OF_JUSTICE_STRIKE = 46469;
const FLOWING_RESOLVE_ACTIVE_BUFF = 62632;
const MAX_IMPACT_DELAY_MS = 1500;

function inferInitialSwordOfJustice(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const signal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === SWORD_OF_JUSTICE_STRIKE &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.value > 0
    );
  if (!signal) return [];
  const skill = skillFor(context, SWORD_OF_JUSTICE);
  const firstStrikeOffset = firstStrikePacketOffsetMs(skill, undefined, {
    explicitOnly: true
  });
  if (firstStrikeOffset == null) return [];
  const start = signal.event.time - firstStrikeOffset;
  const firstEvent = firstPlayerEventTime(context);
  if (!Number.isFinite(firstEvent) || start >= firstEvent) return [];
  if (
    context.recordedActions.some(
      (action) =>
        (action.rawSkillId === SWORD_OF_JUSTICE.skillId || action.rawName === SWORD_OF_JUSTICE.name) &&
        action.start <= signal.event.time &&
        signal.event.time - action.start <= MAX_IMPACT_DELAY_MS
    )
  ) {
    return [];
  }
  const duration = recordedDuration(context, SWORD_OF_JUSTICE);
  return [
    {
      ...canonicalAction(signal.eventIndex, start, SWORD_OF_JUSTICE, signal.event.skillId, 'initial-state'),
      end: start + duration,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    }
  ];
}

function inferInitialFlowingResolve(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === FLOWING_RESOLVE_ACTIVE_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buffDamage > event.value
    );
  if (!initial) return [];
  const duration = recordedDuration(context, FLOWING_RESOLVE);
  const start = initial.event.time - (initial.event.buffDamage - initial.event.value) - duration;
  return [
    {
      ...canonicalAction(initial.eventIndex, start, FLOWING_RESOLVE, initial.event.skillId, 'initial-state'),
      end: start + duration,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    }
  ];
}

function inferInitialJurisdiction(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const skill = skillFor(context, JURISDICTION);
  const firstOffset = firstStrikePacketOffsetMs(skill, undefined, {
    explicitOnly: true
  });
  if (firstOffset == null) return [];
  const signal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === JURISDICTION_FOLLOW_UP_ANIMATION &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.value > 0
    );
  if (!signal) return [];
  const start = signal.event.time - firstOffset;
  const firstEvent = firstPlayerEventTime(context);
  if (!Number.isFinite(firstEvent) || start >= firstEvent) return [];
  const duration = recordedDuration(context, JURISDICTION);
  return [
    {
      ...canonicalAction(signal.eventIndex, start, JURISDICTION, signal.event.skillId, 'initial-state'),
      end: start + duration,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    }
  ];
}

function inferTruncatedRushingJustice(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const firstEvent = firstPlayerEventTime(context);
  if (!Number.isFinite(firstEvent)) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== RUSHING_JUSTICE_IMPACT_ANIMATION ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0 ||
      event.time - event.value >= firstEvent ||
      context.recordedActions.some(
        (action) =>
          action.rawSkillId === RUSHING_JUSTICE_IMPACT_ANIMATION &&
          Math.abs(action.end - event.time) <= SIGNAL_WINDOW_MS
      )
    ) {
      return [];
    }
    return [
      {
        ...canonicalAction(eventIndex, event.time - event.value, RUSHING_JUSTICE, event.skillId, 'animation'),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: 'completed' as const,
        precast: true
      }
    ];
  });
}

export function normalizeGuardianCompositeAnimations(
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const normalized: EvtcRecordedRotationAction[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const action = sorted[index];
    if (action.rawSkillId === JURISDICTION_FOLLOW_UP_ANIMATION) continue;
    if (action.rawSkillId !== RUSHING_JUSTICE_START_ANIMATION) {
      normalized.push(action);
      continue;
    }
    const followUp = sorted[index + 1];
    if (followUp?.rawSkillId !== RUSHING_JUSTICE_IMPACT_ANIMATION || followUp.start - action.end > SIGNAL_WINDOW_MS) {
      normalized.push(action);
      continue;
    }
    normalized.push({
      ...action,
      end: Math.max(action.end, followUp.end),
      expectedDuration:
        action.expectedDuration == null && followUp.expectedDuration == null
          ? null
          : Math.max(Number(action.expectedDuration || 0), Number(followUp.expectedDuration || 0)),
      canonicalSkillId: RUSHING_JUSTICE.skillId,
      canonicalName: RUSHING_JUSTICE.name,
      status: followUp.status
    });
    index += 1;
  }
  return normalized;
}

export function reconstructWillbenderActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return [
    ...actions,
    ...inferInitialSwordOfJustice(context),
    ...inferInitialFlowingResolve(context),
    ...inferInitialJurisdiction(context),
    ...inferTruncatedRushingJustice(context)
  ];
}
