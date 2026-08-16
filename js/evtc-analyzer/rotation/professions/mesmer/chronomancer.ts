import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "../types.js";
import {
  MESMER_EFFECT_GUIDS,
  buffGainSignals,
  canonicalAction,
  clusterSignals,
  directSkillSignals,
  effectSignals,
  hasNearbyAction,
  type MesmerActionIdentity,
  type MesmerSignal,
} from "./shared.js";

const CONTINUUM_SPLIT = Object.freeze({
  name: "Continuum Split",
  skillId: 29830,
});
const CONTINUUM_SHIFT = Object.freeze({
  name: "Continuum Shift",
  skillId: -4,
});
const SPLIT_SECOND = Object.freeze({ name: "Split Second", skillId: 56930 });
const REWINDER = Object.freeze({ name: "Rewinder", skillId: 56928 });
const TIME_SINK = Object.freeze({ name: "Time Sink", skillId: 56873 });

const TIME_ANCHORED_BUFF = 30136;

function shatterSignals(
  context: EvtcProfessionReconstructionContext,
  guid: string,
  fallbackIds: readonly number[],
): MesmerSignal[] {
  const direct = directSkillSignals(context, new Set(fallbackIds));
  const effects = effectSignals(context, guid);
  const usesLegacySplitSecondId = direct.some(
    (signal) => signal.event.skillId === 56925,
  );
  return usesLegacySplitSecondId || !effects.length ? direct : effects;
}

function actionsFromSignals(
  actions: readonly EvtcRecordedRotationAction[],
  identity: MesmerActionIdentity,
  signals: readonly MesmerSignal[],
  gapMs: number,
): EvtcRecordedRotationAction[] {
  return clusterSignals(signals, gapMs).flatMap((signal) =>
    hasNearbyAction(actions, identity, signal.event.time, 100)
      ? []
      : [
          canonicalAction(
            signal.eventIndex,
            signal.event.time,
            identity,
            signal.event.skillId,
            "effect",
          ),
        ],
  );
}

function continuumActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const splits = buffGainSignals(context, TIME_ANCHORED_BUFF).flatMap(
    (signal) =>
      hasNearbyAction(actions, CONTINUUM_SPLIT, signal.event.time, 100)
        ? []
        : [
            canonicalAction(
              signal.eventIndex,
              signal.event.time,
              CONTINUUM_SPLIT,
              signal.event.skillId,
              "buff-transition",
            ),
          ],
  );
  const shifts = context.log.events.flatMap((event, eventIndex) =>
    event.source === context.playerAddress &&
    event.skillId === TIME_ANCHORED_BUFF &&
    event.buff !== 0 &&
    event.buffRemove === 3 &&
    Math.max(event.value, event.buffDamage) > 150 &&
    !hasNearbyAction(actions, CONTINUUM_SHIFT, event.time, 100)
      ? [
          canonicalAction(
            eventIndex,
            event.time,
            CONTINUUM_SHIFT,
            event.skillId,
            "buff-transition",
          ),
        ]
      : [],
  );
  return [...splits, ...shifts];
}

export function reconstructChronomancerActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[],
): EvtcRecordedRotationAction[] {
  const actions = [...recordedActions];
  actions.push(
    ...actionsFromSignals(
      actions,
      SPLIT_SECOND,
      shatterSignals(
        context,
        MESMER_EFFECT_GUIDS.chronomancerSplitSecond,
        [56925, 56930],
      ),
      750,
    ),
  );
  actions.push(
    ...actionsFromSignals(
      actions,
      REWINDER,
      shatterSignals(context, MESMER_EFFECT_GUIDS.chronomancerRewinder, [
        REWINDER.skillId,
      ]),
      750,
    ),
  );
  actions.push(
    ...actionsFromSignals(
      actions,
      TIME_SINK,
      shatterSignals(context, MESMER_EFFECT_GUIDS.chronomancerTimeSink, [
        TIME_SINK.skillId,
      ]),
      5500,
    ),
  );
  actions.push(...continuumActions(context, actions));
  return actions;
}
