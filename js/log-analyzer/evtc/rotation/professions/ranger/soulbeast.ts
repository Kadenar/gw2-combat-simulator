import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcRotationBuffTransition } from '../../profiles.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { directAction, firstPlayerEventTime, rawSkillName } from './shared.js';

const BEASTMODE_BUFF = 42014;
const BEASTMODE = Object.freeze({ name: 'Beastmode', skillId: 42944 });
const LEAVE_BEASTMODE = Object.freeze({
  name: 'Leave Beastmode',
  skillId: 43014
});
const FROST_TRAP = Object.freeze({ name: 'Frost Trap', skillId: 12492 });
const ONE_WOLF_PACK = Object.freeze({
  name: 'One Wolf Pack',
  skillId: 45717
});
const ONE_WOLF_PACK_BUFF = 44139;

const INITIAL_EFFECT_WINDOW_MS = 1000;

export const SOULBEAST_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: BEASTMODE_BUFF,
    gain: BEASTMODE,
    loss: LEAVE_BEASTMODE,
    suppressWeaponSwap: false
  }
];

function isAction(action: EvtcRecordedRotationAction, skillId: number): boolean {
  return action.rawSkillId === skillId || action.canonicalSkillId === skillId;
}

function initialPrecastActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const firstEventTime = firstPlayerEventTime(context);

  if (firstEventTime == null) return [];
  const initialOneWolfPack = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === ONE_WOLF_PACK_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buff !== 0
    );
  const initialFrostTrap = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === FROST_TRAP.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0 &&
        event.time >= firstEventTime &&
        event.time - firstEventTime <= INITIAL_EFFECT_WINDOW_MS
    );
  const identities = [
    ...(initialOneWolfPack &&
    !actions.some((action) => isAction(action, ONE_WOLF_PACK.skillId) && action.start <= initialOneWolfPack.event.time)
      ? [initialOneWolfPack]
      : []),
    ...(initialFrostTrap &&
    !actions.some((action) => isAction(action, FROST_TRAP.skillId) && action.start <= initialFrostTrap.event.time)
      ? [initialFrostTrap]
      : [])
  ];

  if (!identities.length) return [];
  const anchor = actions.length ? Math.min(...actions.map((action) => action.start)) : firstEventTime;
  return identities.map(({ event, eventIndex }, index) => {
    const identity = event.skillId === ONE_WOLF_PACK_BUFF ? ONE_WOLF_PACK : FROST_TRAP;
    return directAction(
      eventIndex,
      anchor - identities.length + index,
      event.skillId,
      rawSkillName(context, event.skillId),
      identity,
      'initial-state',
      { precast: true }
    );
  });
}

export function reconstructSoulbeastActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions = recordedActions.filter((action) => !(isAction(action, BEASTMODE.skillId) && action.initialState));
  return [...actions, ...initialPrecastActions(context, actions)];
}
