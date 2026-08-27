import { EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { inferDetonateActions, normalizeKitTransitions } from './kits.js';
import { canonicalAction, castDuration, combatStartTime, selectedIdentity, selectedSkill } from './shared.js';

const RECONSTRUCTION_FIELD = Object.freeze({ name: 'Reconstruction Field', skillId: 29505 });
const PROTECTION = 717;
const SUPERSPEED = 5974;
const INITIAL_EFFECT_TOLERANCE_MS = 80;
const PRECAST_WINDOW_MS = 2000;

interface InitialBuffEvidence {
  readonly eventIndex: number;
  readonly time: number;
  readonly appliedAt: number;
}

function initialBuffEvidence(context: EvtcProfessionReconstructionContext, skillId: number): InitialBuffEvidence[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_INITIAL ||
      event.buffDamage <= event.value
    ) {
      return [];
    }

    return [{ eventIndex, time: event.time, appliedAt: event.time - (event.buffDamage - event.value) }];
  });
}

function inferOpeningReconstructionField(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (!selectedSkill(context, 'Medic Gyro')) return [];
  const combatStart = combatStartTime(context);

  if (combatStart == null) return [];

  // Reconstruction Field is absent when its cast finishes before EVTC starts, but its protection and
  // Speed of Synergy superspeed retain the same elapsed-time fingerprint in the initial buff state.
  const protection = initialBuffEvidence(context, PROTECTION);
  const superspeed = initialBuffEvidence(context, SUPERSPEED);
  const pair = protection
    .flatMap((left) =>
      superspeed.map((right) => ({
        left,
        right,
        difference: Math.abs(left.appliedAt - right.appliedAt),
        appliedAt: Math.round((left.appliedAt + right.appliedAt) / 2)
      }))
    )
    .filter(
      ({ left, right, difference, appliedAt }) =>
        Math.abs(left.time - right.time) <= INITIAL_EFFECT_TOLERANCE_MS &&
        difference <= INITIAL_EFFECT_TOLERANCE_MS &&
        appliedAt <= combatStart &&
        combatStart - appliedAt <= PRECAST_WINDOW_MS
    )
    .sort((left, right) => left.difference - right.difference)[0];

  if (!pair) return [];

  const alreadyRecorded = context.recordedActions.some(
    (action) =>
      action.rawSkillId === RECONSTRUCTION_FIELD.skillId &&
      Math.abs(action.end - pair.appliedAt) <= INITIAL_EFFECT_TOLERANCE_MS
  );

  if (alreadyRecorded) return [];

  const identity = selectedIdentity(context, RECONSTRUCTION_FIELD.name, RECONSTRUCTION_FIELD.skillId);
  const duration = castDuration(context, identity);
  return [
    {
      ...canonicalAction(
        Math.min(pair.left.eventIndex, pair.right.eventIndex) - 1,
        pair.appliedAt - duration,
        identity,
        RECONSTRUCTION_FIELD.skillId,
        'initial-state'
      ),
      end: pair.appliedAt,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    }
  ];
}

export function reconstructScrapperActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions = normalizeKitTransitions(context, context.recordedActions);
  actions.push(...inferDetonateActions(context));
  actions.push(...inferOpeningReconstructionField(context));
  return actions;
}
