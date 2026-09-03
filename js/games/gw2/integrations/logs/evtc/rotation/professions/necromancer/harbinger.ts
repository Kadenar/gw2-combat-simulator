import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import type { EvtcRotationBuffTransition } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  effectAction,
  hasRecordedAction,
  INSTANT_SIGNAL_WINDOW_MS
} from '#gw2/integrations/logs/evtc/rotation/professions/necromancer/shared.js';

const PLAGUE_SIGNET = Object.freeze({ name: 'Plague Signet', skillId: 10562 });
const PLAGUE_SIGNET_PASSIVE_BUFF = 72368;
const BLOOD_IS_POWER = Object.freeze({ name: 'Blood Is Power', skillId: 10544 });

export const HARBINGER_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: 59964,
    gain: { name: 'Harbinger Shroud', skillId: 62567 },
    loss: { name: 'Exit Harbinger Shroud', skillId: 62540 },
    suppressWeaponSwap: true
  }
];

function isAction(
  action: EvtcRecordedRotationAction,
  identity: { readonly name: string; readonly skillId: number }
): boolean {
  return (
    action.rawSkillId === identity.skillId ||
    action.canonicalSkillId === identity.skillId ||
    action.rawName.trim().toLowerCase() === identity.name.toLowerCase() ||
    action.canonicalName?.trim().toLowerCase() === identity.name.toLowerCase()
  );
}

/** Moves a passive-buff signal to the end of an overlapping Blood Is Power so its self-conditions exist to transfer. */
function plagueSignetReplayTime(recordedActions: readonly EvtcRecordedRotationAction[], observedAt: number): number {
  return recordedActions.reduce((replayAt, action) => {
    const replayEnd = action.replayCastEnd ?? action.start + (action.replayInterruptMs ?? action.end - action.start);
    return isAction(action, BLOOD_IS_POWER) && action.start <= observedAt && observedAt < replayEnd
      ? Math.max(replayAt, replayEnd)
      : replayAt;
  }, observedAt);
}

/** Recovers active Plague Signet uses from removal of its passive buff, which Arc records without a cast animation. */
function plagueSignetActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.target !== context.playerAddress ||
      event.skillId !== PLAGUE_SIGNET_PASSIVE_BUFF ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE ||
      event.buffRemove === 0 ||
      hasRecordedAction(context, PLAGUE_SIGNET.skillId, PLAGUE_SIGNET.name, event.time, INSTANT_SIGNAL_WINDOW_MS) ||
      actions.some((action) => Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS)
    ) {
      return;
    }

    actions.push(
      effectAction(
        eventIndex,
        plagueSignetReplayTime(recordedActions, event.time),
        event.skillId,
        PLAGUE_SIGNET.name,
        PLAGUE_SIGNET,
        'buff-transition'
      )
    );
  });
  return actions;
}

export function reconstructHarbingerActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  return [...context.recordedActions, ...plagueSignetActions(context, context.recordedActions)];
}
