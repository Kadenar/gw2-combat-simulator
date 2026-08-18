import { EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcRotationBuffTransition } from '../../profiles.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { effectAction, hasRecordedAction, INSTANT_SIGNAL_WINDOW_MS } from './shared.js';

const SUMMON_SPIRITS = Object.freeze({
  name: 'Summon Spirits',
  skillId: 76607
});
const INNERVATE_ANGUISH = Object.freeze({
  name: 'Innervate Anguish',
  skillId: 77003
});
const INNERVATE_WANDERLUST = Object.freeze({
  name: 'Innervate Wanderlust',
  skillId: 76732
});

// Summon Spirits has no cast event. Its active spirit attacks use these IDs;
// backdating by the mechanic's hit delay recovers the activation timestamp.
const SUMMON_SPIRITS_SIGNALS = new Map([
  [77860, 840],
  [78660, 360],
  [79246, 360]
]);
const INNERVATE_ANGUISH_SIGNAL = 77050;
const FEAR_BUFF = 791;
const SUMMON_SPIRITS_SIGNAL_WINDOW_MS = 2500;

export const RITUALIST_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: 76958,
    gain: { name: "Ritualist's Shroud", skillId: 77238 },
    loss: { name: "Exit Ritualist's Shroud", skillId: 76933 },
    suppressWeaponSwap: true
  }
];

function summonSpiritsActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (event.source !== context.playerAddress) return;
    const delay = SUMMON_SPIRITS_SIGNALS.get(event.skillId);
    if (delay == null || event.buff !== 0) return;
    const start = event.time - delay;
    if (
      hasRecordedAction(context, SUMMON_SPIRITS.skillId, SUMMON_SPIRITS.name, start, INSTANT_SIGNAL_WINDOW_MS) ||
      actions.some((action) => Math.abs(action.start - start) <= SUMMON_SPIRITS_SIGNAL_WINDOW_MS)
    ) {
      return;
    }
    actions.push(effectAction(eventIndex, start, event.skillId, SUMMON_SPIRITS.name));
  });
  return actions;
}

function innervateAnguishActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (event.source !== context.playerAddress || event.skillId !== INNERVATE_ANGUISH_SIGNAL || event.buff !== 0) {
      return;
    }
    if (
      hasRecordedAction(
        context,
        INNERVATE_ANGUISH.skillId,
        INNERVATE_ANGUISH.name,
        event.time,
        INSTANT_SIGNAL_WINDOW_MS
      ) ||
      actions.some((action) => Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS)
    ) {
      return;
    }
    actions.push(effectAction(eventIndex, event.time, event.skillId, INNERVATE_ANGUISH.name));
  });
  return actions;
}

function innervateWanderlustActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== FEAR_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      Math.max(event.value, event.buffDamage) !== 1500
    ) {
      return;
    }
    if (
      hasRecordedAction(
        context,
        INNERVATE_WANDERLUST.skillId,
        INNERVATE_WANDERLUST.name,
        event.time,
        INSTANT_SIGNAL_WINDOW_MS
      ) ||
      actions.some((action) => Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS)
    ) {
      return;
    }
    actions.push(effectAction(eventIndex, event.time, event.skillId, INNERVATE_WANDERLUST.name));
  });
  return actions;
}

export function reconstructRitualistActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  return [
    ...context.recordedActions,
    ...summonSpiritsActions(context),
    ...innervateAnguishActions(context),
    ...innervateWanderlustActions(context)
  ];
}
