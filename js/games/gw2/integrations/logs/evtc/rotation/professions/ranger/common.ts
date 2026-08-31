import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { ownedPetAddresses } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/pets.js';
import {
  directAction,
  firstPlayerEventTime,
  playerInstance,
  rawSkillName,
  type RangerActionIdentity
} from '#gw2/integrations/logs/evtc/rotation/professions/ranger/shared.js';

const SHARPENING_STONE = Object.freeze({
  name: 'Sharpening Stone',
  skillId: 12536
});
const PATH_OF_SCARS = Object.freeze({
  name: 'Path of Scars',
  skillId: 12638
});
const PATH_OF_SCARS_MAX_RANGE = Object.freeze({
  name: 'Path of Scars (Max Range)',
  skillId: -1001
});
const SIC_EM = Object.freeze({ name: '"Sic \'Em!"', skillId: 12633 });
const SIC_EM_BUFF = 33902;
const OVERBEARING_SMASH = Object.freeze({
  name: 'Overbearing Smash',
  skillId: 69262
});
const OVERBEARING_FOLLOW_UP_RAW_ID = 63201;

const TRANSITION_WINDOW_MS = 150;
const INITIAL_REFRESH_WINDOW_MS = 5000;
const PATH_RETURN_GAP_THRESHOLD_MS = 900;
const PATH_HIT_WINDOW_MS = 3000;
const TRUNCATED_CAST_WINDOW_MS = 150;
const SIC_EM_RECAST_SIGNAL_MS = 60000;

function isAction(action: EvtcRecordedRotationAction, skillId: number): boolean {
  return action.rawSkillId === skillId || action.canonicalSkillId === skillId;
}

function truncatedOverbearingSmashActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const firstEventTime = firstPlayerEventTime(context);
  if (firstEventTime == null) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== OVERBEARING_SMASH.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }

    const start = event.time - event.value;
    const alreadyRecorded = actions.some(
      (action) => action.rawSkillId === event.skillId && Math.abs(action.end - event.time) <= TRUNCATED_CAST_WINDOW_MS
    );
    if (alreadyRecorded || start >= firstEventTime) return [];
    return [
      {
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          rawSkillName(context, event.skillId),
          OVERBEARING_SMASH,
          'initial-state'
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: 'completed' as const,
        precast: true
      }
    ];
  });
}

function coalesceOverbearingSmash(actions: readonly EvtcRecordedRotationAction[]): EvtcRecordedRotationAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const absorbed = new Set<EvtcRecordedRotationAction>();
  return sorted.flatMap((action) => {
    if (absorbed.has(action)) return [];
    if (action.rawSkillId !== OVERBEARING_SMASH.skillId) return [action];
    const followUp = sorted.find(
      (candidate) =>
        !absorbed.has(candidate) &&
        candidate.rawSkillId === OVERBEARING_FOLLOW_UP_RAW_ID &&
        candidate.start >= action.end - 50 &&
        candidate.start - action.end <= TRUNCATED_CAST_WINDOW_MS
    );
    if (!followUp) return [action];
    absorbed.add(followUp);
    return [
      {
        ...action,
        end: Math.max(action.end, followUp.end),
        expectedDuration:
          Math.max(0, Number(action.expectedDuration || 0)) + Math.max(0, Number(followUp.expectedDuration || 0)),
        canonicalSkillId: OVERBEARING_SMASH.skillId,
        canonicalName: OVERBEARING_SMASH.name,
        status: followUp.status === 'interrupted' || action.status === 'interrupted' ? 'interrupted' : 'completed'
      }
    ];
  });
}

function selectedSkill(context: EvtcProfessionReconstructionContext, identity: RangerActionIdentity): boolean {
  if (context.selectedSkillIds?.includes(identity.skillId)) return true;
  const normalized = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return context.selectedSkillNames?.some((name) => normalized(name) === normalized(identity.name)) === true;
}

function sicEmActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  const pets = ownerInstance == null ? new Set<bigint>() : ownedPetAddresses(context, ownerInstance);
  const selected = selectedSkill(context, SIC_EM);
  const validTarget = (target: bigint): boolean => target === context.playerAddress || (selected && pets.has(target));
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        validTarget(event.target) &&
        event.skillId === SIC_EM_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buff !== 0
    );
  const applications = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        validTarget(event.target) &&
        event.skillId === SIC_EM_BUFF &&
        (event.stateChange === EVTC_STATE_CHANGE.NONE || event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY) &&
        event.buff !== 0 &&
        event.buffRemove === 0 &&
        (event.target === context.playerAddress ||
          initial == null ||
          event.time - initial.event.time >= SIC_EM_RECAST_SIGNAL_MS)
    );
  const inferred = applications.flatMap(({ event, eventIndex }, index) => {
    if (index > 0 && event.time - applications[index - 1].event.time <= TRANSITION_WINDOW_MS) {
      return [];
    }

    return [
      directAction(
        eventIndex,
        event.time,
        event.skillId,
        rawSkillName(context, event.skillId),
        SIC_EM,
        'buff-transition'
      )
    ];
  });
  if (!initial) return inferred;
  const anchor = Math.min(initial.event.time, ...actions.map((action) => action.start));
  return [
    directAction(
      initial.eventIndex,
      anchor - 1,
      initial.event.skillId,
      rawSkillName(context, initial.event.skillId),
      SIC_EM,
      'initial-state',
      { precast: true }
    ),
    ...inferred
  ];
}

function normalizePathOfScarsRange(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const pathActions = actions
    .filter((action) => action.rawSkillId === PATH_OF_SCARS.skillId)
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  return actions.map((action) => {
    if (action.rawSkillId !== PATH_OF_SCARS.skillId) return action;
    const pathIndex = pathActions.indexOf(action);
    const nextStart = pathActions[pathIndex + 1]?.start ?? Number.POSITIVE_INFINITY;
    const hits = context.log.events
      .filter(
        (event) =>
          event.source === context.playerAddress &&
          event.skillId === PATH_OF_SCARS.skillId &&
          event.stateChange === EVTC_STATE_CHANGE.NONE &&
          event.activation === EVTC_ACTIVATION.NONE &&
          event.buff === 0 &&
          event.value > 0 &&
          event.target !== context.playerAddress &&
          event.time >= action.start &&
          event.time <= action.start + PATH_HIT_WINDOW_MS &&
          event.time < nextStart
      )
      .sort((left, right) => left.time - right.time);
    if (hits.length < 2 || hits[1].time - hits[0].time <= PATH_RETURN_GAP_THRESHOLD_MS) {
      return action;
    }

    return {
      ...action,
      canonicalSkillId: PATH_OF_SCARS_MAX_RANGE.skillId,
      canonicalName: PATH_OF_SCARS_MAX_RANGE.name
    };
  });
}

function sharpeningStoneActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === SHARPENING_STONE.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buff !== 0
    );
  let previousApplication = Number.NEGATIVE_INFINITY;
  const applications = context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== SHARPENING_STONE.skillId ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY) ||
      Math.max(event.value, event.buffDamage) < 29000 ||
      event.time - previousApplication <= TRANSITION_WINDOW_MS ||
      (initial != null && event.time - initial.event.time <= INITIAL_REFRESH_WINDOW_MS)
    ) {
      return [];
    }

    previousApplication = event.time;
    return [directAction(eventIndex, event.time, event.skillId, SHARPENING_STONE.name, SHARPENING_STONE, 'effect')];
  });
  if (!initial) return applications;
  const anchor = Math.min(initial.event.time, ...actions.map((action) => action.start));
  return [
    directAction(
      initial.eventIndex,
      anchor - 1,
      SHARPENING_STONE.skillId,
      SHARPENING_STONE.name,
      SHARPENING_STONE,
      'initial-state',
      { precast: true }
    ),
    ...applications
  ];
}

export function addRangerCommonActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const normalized = normalizePathOfScarsRange(context, actions);
  const sharpening = sharpeningStoneActions(context, normalized);
  const withSharpening = [...normalized, ...sharpening];
  return [...withSharpening, ...sicEmActions(context, withSharpening)];
}

export function normalizeRangerCommonActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const truncated = truncatedOverbearingSmashActions(context, actions);
  return coalesceOverbearingSmash([...actions, ...truncated]);
}
