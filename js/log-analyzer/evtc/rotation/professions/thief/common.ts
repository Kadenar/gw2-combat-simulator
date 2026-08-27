import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import { findRotationSkill } from '../../catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import {
  ASSASSINS_SIGNET,
  ASSASSINS_SIGNET_ACTIVE_BUFF,
  canonicalAction,
  combatStart,
  hasRecordedAction,
  playerEvent,
  SIGNAL_WINDOW_MS,
  skillDuration
} from './shared.js';
import type { ThiefActionIdentity } from './shared.js';

const CALTROPS = Object.freeze({ name: 'Caltrops', skillId: 13028 });
const SPIDER_VENOM = Object.freeze({ name: 'Spider Venom', skillId: 13037 });
const PREPARE_THOUSAND_NEEDLES = Object.freeze({
  name: 'Prepare Thousand Needles',
  skillId: 13026
});
const THOUSAND_NEEDLES = Object.freeze({
  name: 'Thousand Needles',
  skillId: 56898
});
const CHAK_SHIELD = Object.freeze({ name: 'Chak Shield', skillId: 76816 });
const SKRITT_SWIPE = Object.freeze({ name: 'Skritt Swipe', skillId: 77397 });

const SPIDER_VENOM_BUFF = 13036;
const PREPARED_THOUSAND_NEEDLES_BUFF = 56895;
const CHAK_SHIELD_BUFF = 78288;
const EFFECT_START_STATE_CHANGE = 57;

function uniqueBuffApplyActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  buffSkillId: number,
  identity: ThiefActionIdentity
): EvtcRecordedRotationAction[] {
  const inferred: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== buffSkillId ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      hasRecordedAction(actions, identity, event.time) ||
      inferred.some((action) => Math.abs(action.start - event.time) <= SIGNAL_WINDOW_MS)
    ) {
      return;
    }

    inferred.push(canonicalAction(eventIndex, event.time, identity, event.skillId));
  });
  return inferred;
}

function thousandNeedlesActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const inferred: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== PREPARED_THOUSAND_NEEDLES_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 3 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE ||
      hasRecordedAction(actions, THOUSAND_NEEDLES, event.time) ||
      inferred.some((action) => Math.abs(action.start - event.time) <= SIGNAL_WINDOW_MS)
    ) {
      return;
    }

    inferred.push(canonicalAction(eventIndex, event.time, THOUSAND_NEEDLES, event.skillId));
  });
  return inferred;
}

function initialPrepareThousandNeedlesAction(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === PREPARED_THOUSAND_NEEDLES_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
    );
  const atCombat = combatStart(context);

  if (atCombat == null) return [];
  const skill = findRotationSkill(
    PREPARE_THOUSAND_NEEDLES.skillId,
    PREPARE_THOUSAND_NEEDLES.name,
    context.catalog,
    context.profile
  );
  const duration = skillDuration(context, PREPARE_THOUSAND_NEEDLES);
  const cooldownMs = Math.max(0, Number(skill?.cooldown || 0) * 1000);
  let eventIndex = initial?.eventIndex;
  let rawSkillId = initial?.event.skillId;
  let anchor = atCombat;

  if (!initial) {
    const firstPrepare = actions
      .filter(
        (action) =>
          action.rawSkillId === PREPARE_THOUSAND_NEEDLES.skillId ||
          action.canonicalSkillId === PREPARE_THOUSAND_NEEDLES.skillId
      )
      .sort((left, right) => left.start - right.start)[0];
    const truncatedCaltrops = context.log.events.some(
      (event) =>
        event.source === context.playerAddress &&
        event.skillId === CALTROPS.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
        event.value > 0 &&
        event.time - event.value < atCombat &&
        event.time >= atCombat
    );

    if (!firstPrepare || !truncatedCaltrops || firstPrepare.start > atCombat + 2_000) {
      return [];
    }

    eventIndex = firstPrepare.eventIndex - 0.2;
    rawSkillId = PREPARED_THOUSAND_NEEDLES_BUFF;
    anchor = firstPrepare.start;
  }

  const start = anchor - cooldownMs - duration;
  return [
    {
      ...canonicalAction(
        eventIndex ?? -1,
        start,
        PREPARE_THOUSAND_NEEDLES,
        rawSkillId ?? PREPARED_THOUSAND_NEEDLES_BUFF,
        'initial-state'
      ),
      end: start + duration,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    }
  ];
}

function unrecordedOpeningThousandNeedlesAction(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const hasInitialPreparedState = context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === PREPARED_THOUSAND_NEEDLES_BUFF &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
  );

  if (hasInitialPreparedState) return [];
  const atCombat = combatStart(context);
  const firstPrepare = actions
    .filter(
      (action) =>
        action.rawSkillId === PREPARE_THOUSAND_NEEDLES.skillId ||
        action.canonicalSkillId === PREPARE_THOUSAND_NEEDLES.skillId
    )
    .sort((left, right) => left.start - right.start)[0];

  if (atCombat == null || !firstPrepare || firstPrepare.start > atCombat + 2_000) {
    return [];
  }

  const hasTruncatedCaltrops = context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === CALTROPS.skillId &&
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
      event.value > 0 &&
      event.time - event.value < atCombat &&
      event.time >= atCombat
  );

  if (!hasTruncatedCaltrops) return [];
  return [
    canonicalAction(
      firstPrepare.eventIndex - 0.1,
      firstPrepare.start - 1,
      THOUSAND_NEEDLES,
      PREPARED_THOUSAND_NEEDLES_BUFF,
      'initial-state'
    )
  ];
}

function initialSkrittSwipeAction(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const signal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === SKRITT_SWIPE.skillId &&
        event.stateChange === EFFECT_START_STATE_CHANGE
    );

  if (!signal || hasRecordedAction(actions, SKRITT_SWIPE, signal.event.time, 500)) {
    return [];
  }

  const atCombat = combatStart(context) ?? signal.event.time;
  const duration = skillDuration(context, SKRITT_SWIPE);
  const end = Math.min(atCombat, signal.event.time);
  return [
    {
      ...canonicalAction(signal.eventIndex, end - duration, SKRITT_SWIPE, signal.event.skillId, 'initial-state'),
      end,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    }
  ];
}

function truncatedCaltropsAction(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const firstPlayerEventTime = Math.min(
    ...context.log.events.filter((event) => event.time > 0 && playerEvent(context, event)).map((event) => event.time)
  );

  if (!Number.isFinite(firstPlayerEventTime)) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== CALTROPS.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0 ||
      event.time - event.value >= firstPlayerEventTime ||
      hasRecordedAction(actions, CALTROPS, event.time, 1000)
    ) {
      return [];
    }

    const start = event.time - event.value;
    return [
      {
        ...canonicalAction(eventIndex, start, CALTROPS, event.skillId, 'animation'),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: 'completed' as const,
        precast: true
      }
    ];
  });
}

export function reconstructThiefCommonActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return [
    ...actions,
    ...truncatedCaltropsAction(context, actions),
    ...initialSkrittSwipeAction(context, actions),
    ...initialPrepareThousandNeedlesAction(context, actions),
    ...unrecordedOpeningThousandNeedlesAction(context, actions),
    ...uniqueBuffApplyActions(context, actions, ASSASSINS_SIGNET_ACTIVE_BUFF, ASSASSINS_SIGNET),
    ...uniqueBuffApplyActions(context, actions, SPIDER_VENOM_BUFF, SPIDER_VENOM),
    ...uniqueBuffApplyActions(context, actions, CHAK_SHIELD_BUFF, CHAK_SHIELD),
    ...thousandNeedlesActions(context, actions)
  ];
}
