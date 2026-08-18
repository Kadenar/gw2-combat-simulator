import { EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import {
  MESMER_EFFECT_GUIDS,
  buffGainSignals,
  canonicalAction,
  clusterSignals,
  directSkillSignals,
  effectSignals,
  hasNearbyAction,
  type MesmerActionIdentity,
  type MesmerSignal
} from './shared.js';

const DODGE = Object.freeze({ name: 'Dodge / Mirage Cloak', skillId: -1 });
const PICK_UP_MIRAGE_MIRROR = Object.freeze({
  name: 'Pick Up Mirage Mirror',
  skillId: -2
});
const CRY_OF_FRUSTRATION = Object.freeze({
  name: 'Cry of Frustration',
  skillId: 10190
});
const MIND_WRACK = Object.freeze({ name: 'Mind Wrack', skillId: 10191 });
const DIVERSION = Object.freeze({ name: 'Diversion', skillId: 10287 });

const MIRAGE_CLOAK_BUFF = 40408;
const DISTORTION_BUFF = 10243;
const MIRAGE_MIRROR_DAMAGE = 44677;

function primaryShatterSignals(
  context: EvtcProfessionReconstructionContext,
  identity: MesmerActionIdentity,
  guid: string,
  gapMs: number
): MesmerSignal[] {
  const direct = directSkillSignals(context, new Set([identity.skillId]));
  const signals = direct.length ? direct : effectSignals(context, guid);
  return clusterSignals(signals, gapMs);
}

function shatterActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const crySignals = primaryShatterSignals(context, CRY_OF_FRUSTRATION, MESMER_EFFECT_GUIDS.cryOfFrustration, 750);
  const mindSignals = primaryShatterSignals(context, MIND_WRACK, MESMER_EFFECT_GUIDS.distortionOrMindWrack, 1250);
  const distortionTimes = clusterSignals(buffGainSignals(context, DISTORTION_BUFF), 500).map(
    (signal) => signal.event.time
  );
  const otherShatterTimes = [
    ...crySignals.map((signal) => signal.event.time),
    ...mindSignals.map((signal) => signal.event.time),
    ...distortionTimes
  ];
  const diversionSignals = clusterSignals(effectSignals(context, MESMER_EFFECT_GUIDS.diversion), 750).filter(
    (signal) => !otherShatterTimes.some((time) => signal.event.time >= time && signal.event.time - time <= 1000)
  );
  return [
    ...crySignals.map((signal) => ({ signal, identity: CRY_OF_FRUSTRATION })),
    ...mindSignals.map((signal) => ({ signal, identity: MIND_WRACK })),
    ...diversionSignals.map((signal) => ({ signal, identity: DIVERSION }))
  ].flatMap(({ signal, identity }) =>
    hasNearbyAction(actions, identity, signal.event.time, 100)
      ? []
      : [canonicalAction(signal.eventIndex, signal.event.time, identity, signal.event.skillId, 'effect')]
  );
}

function mirageCloakActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const mirrorSignals = effectSignals(context, MESMER_EFFECT_GUIDS.mirageMirror);
  if (!mirrorSignals.length) {
    mirrorSignals.push(...directSkillSignals(context, new Set([MIRAGE_MIRROR_DAMAGE])));
  }
  return buffGainSignals(context, MIRAGE_CLOAK_BUFF, true)
    .filter(
      (signal) =>
        signal.event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ||
        Math.max(signal.event.value, signal.event.buffDamage) <= 900
    )
    .flatMap((signal) => {
      const mirror = mirrorSignals.some((candidate) => Math.abs(candidate.event.time - signal.event.time) <= 50);
      const identity = mirror ? PICK_UP_MIRAGE_MIRROR : DODGE;
      if (hasNearbyAction(actions, identity, signal.event.time, 100)) return [];
      return [
        canonicalAction(
          signal.eventIndex,
          signal.event.time,
          identity,
          signal.event.skillId,
          signal.event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ? 'initial-state' : 'buff-transition',
          signal.event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ? { initialState: true, precast: true } : {}
        )
      ];
    });
}

export function reconstructMirageActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions = [...recordedActions];
  actions.push(...shatterActions(context, actions));
  actions.push(...mirageCloakActions(context, actions));
  return actions;
}
