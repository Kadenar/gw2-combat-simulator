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

const CONTINUUM_SPLIT = Object.freeze({
  name: 'Continuum Split',
  skillId: 29830
});
const CONTINUUM_SHIFT = Object.freeze({
  name: 'Continuum Shift',
  skillId: -4
});
const SPLIT_SECOND = Object.freeze({ name: 'Split Second', skillId: 56930 });
const REWINDER = Object.freeze({ name: 'Rewinder', skillId: 56928 });
const TIME_SINK = Object.freeze({ name: 'Time Sink', skillId: 56873 });
const DISTORTION = Object.freeze({ name: 'Distortion', skillId: 10192 });
const MIRROR_IMAGES = Object.freeze({ name: 'Mirror Images', skillId: 10202 });

const TIME_ANCHORED_BUFF = 30136;
const MAXIMUM_SHATTER_SOURCES = 4;

interface ShatterSignalSet {
  readonly signals: readonly MesmerSignal[];
  readonly maximumClusterSize?: number;
}

const RESOURCE_SHATTER_IDS: ReadonlySet<number> = new Set([
  SPLIT_SECOND.skillId,
  REWINDER.skillId,
  TIME_SINK.skillId,
  DISTORTION.skillId
]);

function shatterSignals(
  context: EvtcProfessionReconstructionContext,
  guid: string,
  fallbackIds: readonly number[]
): ShatterSignalSet {
  const direct = directSkillSignals(context, new Set(fallbackIds));
  const effects = effectSignals(context, guid);
  return effects.length ? { signals: effects, maximumClusterSize: MAXIMUM_SHATTER_SOURCES } : { signals: direct };
}

function actionsFromSignals(
  actions: readonly EvtcRecordedRotationAction[],
  identity: MesmerActionIdentity,
  signalSet: ShatterSignalSet,
  gapMs: number
): EvtcRecordedRotationAction[] {
  return clusterSignals(signalSet.signals, gapMs, signalSet.maximumClusterSize).flatMap((signal) =>
    hasNearbyAction(actions, identity, signal.event.time, 100)
      ? []
      : [canonicalAction(signal.eventIndex, signal.event.time, identity, signal.event.skillId, 'effect')]
  );
}

function continuumActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const splits = buffGainSignals(context, TIME_ANCHORED_BUFF).flatMap((signal) =>
    hasNearbyAction(actions, CONTINUUM_SPLIT, signal.event.time, 100)
      ? []
      : [
          canonicalAction(
            signal.eventIndex,
            signal.event.time,
            CONTINUUM_SPLIT,
            signal.event.skillId,
            'buff-transition'
          )
        ]
  );
  const shifts = context.log.events.flatMap((event, eventIndex) =>
    event.source === context.playerAddress &&
    event.skillId === TIME_ANCHORED_BUFF &&
    event.buff !== 0 &&
    event.buffRemove === 3 &&
    Math.max(event.value, event.buffDamage) > 150 &&
    !hasNearbyAction(actions, CONTINUUM_SHIFT, event.time, 100)
      ? [canonicalAction(eventIndex, event.time, CONTINUUM_SHIFT, event.skillId, 'buff-transition')]
      : []
  );
  return [...splits, ...shifts];
}

function missingMirrorImagesActions(actions: readonly EvtcRecordedRotationAction[]): EvtcRecordedRotationAction[] {
  const mirrors = actions
    .filter(
      (action) => action.rawSkillId === MIRROR_IMAGES.skillId || action.canonicalSkillId === MIRROR_IMAGES.skillId
    )
    .sort((left, right) => left.start - right.start);
  const ordinaryIntervals = mirrors
    .slice(1)
    .map((mirror, index) => mirror.start - mirrors[index].start)
    .filter((interval) => interval >= 10_000 && interval <= 35_000);
  if (!ordinaryIntervals.length) return [];

  const observedRecharge = Math.min(...ordinaryIntervals);
  const shatters = actions
    .filter((action) => RESOURCE_SHATTER_IDS.has(Number(action.canonicalSkillId ?? action.rawSkillId)))
    .sort((left, right) => left.start - right.start);
  const inferred: EvtcRecordedRotationAction[] = [];

  for (let index = 1; index < mirrors.length; index += 1) {
    const previousMirror = mirrors[index - 1];
    const nextMirror = mirrors[index];
    if (nextMirror.start - previousMirror.start < observedRecharge * 1.75) {
      continue;
    }

    for (
      let expected = previousMirror.start + observedRecharge;
      expected < nextMirror.start - observedRecharge * 0.75;
      expected += observedRecharge
    ) {
      const candidates = shatters
        .slice(1)
        .map((later, shatterIndex) => ({
          earlier: shatters[shatterIndex],
          later
        }))
        .filter(
          ({ earlier, later }) =>
            later.start - earlier.start <= 750 &&
            Math.abs((earlier.start + later.start) / 2 - expected) <= 3000 &&
            ![...mirrors, ...inferred].some((mirror) => mirror.start > earlier.start && mirror.start < later.start)
        )
        .sort(
          (left, right) =>
            Math.abs((left.earlier.start + left.later.start) / 2 - expected) -
            Math.abs((right.earlier.start + right.later.start) / 2 - expected)
        );
      const candidate = candidates[0];
      if (!candidate) continue;
      inferred.push(
        canonicalAction(
          candidate.later.eventIndex,
          Math.floor((candidate.earlier.start + candidate.later.start) / 2),
          MIRROR_IMAGES,
          MIRROR_IMAGES.skillId,
          'resource-inference'
        )
      );
    }
  }

  return inferred;
}

export function reconstructChronomancerActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions = [...recordedActions];
  actions.push(
    ...actionsFromSignals(
      actions,
      SPLIT_SECOND,
      shatterSignals(context, MESMER_EFFECT_GUIDS.chronomancerSplitSecond, [56925, 56930]),
      750
    )
  );
  actions.push(
    ...actionsFromSignals(
      actions,
      REWINDER,
      shatterSignals(context, MESMER_EFFECT_GUIDS.chronomancerRewinder, [REWINDER.skillId]),
      750
    )
  );
  actions.push(
    ...actionsFromSignals(
      actions,
      TIME_SINK,
      shatterSignals(context, MESMER_EFFECT_GUIDS.chronomancerTimeSink, [TIME_SINK.skillId]),
      5500
    )
  );
  actions.push(...continuumActions(context, actions));
  actions.push(...missingMirrorImagesActions(actions));
  return actions;
}
