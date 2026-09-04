import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import type { EvtcRotationBuffTransition } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  canonicalAction,
  combatStart,
  hasRecordedAction,
  hasSelectedSkill,
  SIGNAL_WINDOW_MS,
  skillDuration
} from '#gw2/integrations/logs/evtc/rotation/professions/thief/shared.js';

const SPIDER_VENOM = Object.freeze({ name: 'Spider Venom', skillId: 13037 });
const WELL_OF_SORROW = Object.freeze({
  name: 'Well of Sorrow',
  skillId: 63276
});
const SPIDER_VENOM_BUFF = 13036;
const SHADOW_SHROUD_BUFF = 63239;

export const SPECTER_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: SHADOW_SHROUD_BUFF,
    gain: { name: 'Enter Shadow Shroud', skillId: 63155 },
    loss: { name: 'Exit Shadow Shroud', skillId: 63251 },
    suppressWeaponSwap: true
  }
];

function specterPrecastActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  if (!hasSelectedSkill(context, WELL_OF_SORROW)) return [];
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  const wellSignal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === WELL_OF_SORROW.skillId &&
        event.buff === 0 &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.value > 0 &&
        Math.abs(event.time - atCombat) <= SIGNAL_WINDOW_MS
    );
  if (!wellSignal || hasRecordedAction(actions, WELL_OF_SORROW, atCombat, 1_000)) {
    return [];
  }

  const duration = skillDuration(context, WELL_OF_SORROW);
  const wellStart = atCombat - duration;
  const inferred: EvtcRecordedRotationAction[] = [
    {
      ...canonicalAction(wellSignal.eventIndex, wellStart, WELL_OF_SORROW, wellSignal.event.skillId, 'initial-state'),
      end: atCombat,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    }
  ];
  const initialSpider = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === SPIDER_VENOM_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
    );
  if (
    initialSpider &&
    hasSelectedSkill(context, SPIDER_VENOM) &&
    !hasRecordedAction(actions, SPIDER_VENOM, atCombat, 1_000)
  ) {
    inferred.push({
      ...canonicalAction(
        initialSpider.eventIndex,
        wellStart - 1,
        SPIDER_VENOM,
        initialSpider.event.skillId,
        'initial-state'
      ),
      precast: true
    });
  }

  return inferred;
}

function specterDelayedWeaponSwapActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const transitions = context.log.events.filter(
    (event) =>
      event.target === context.playerAddress &&
      event.skillId === SHADOW_SHROUD_BUFF &&
      event.buff !== 0 &&
      (event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY || event.stateChange === EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE)
  );
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.stateChange !== EVTC_STATE_CHANGE.WEAPON_SWAP ||
      actions.some((action) => action.rawName === 'Swap Weapons' && action.start === event.time)
    ) {
      return [];
    }

    const transitionDistance = Math.min(...transitions.map((transition) => Math.abs(transition.time - event.time)));
    if (transitionDistance <= 50 || transitionDistance > SIGNAL_WINDOW_MS) {
      return [];
    }

    const rawSet = Number(event.target);
    return [
      {
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: 0,
        rawName: 'Swap Weapons',
        evidence: 'state-change' as const,
        status: 'instant' as const,
        eventIndex,
        weaponSet: Number.isSafeInteger(rawSet) && rawSet > 0 ? rawSet : null
      }
    ];
  });
}

export function reconstructSpecterActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const withWeaponSwaps = [...actions, ...specterDelayedWeaponSwapActions(context, actions)];
  return [...withWeaponSwaps, ...specterPrecastActions(context, withWeaponSwaps)];
}
