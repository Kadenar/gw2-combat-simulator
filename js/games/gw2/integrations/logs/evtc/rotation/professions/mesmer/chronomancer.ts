import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  MESMER_EFFECT_GUIDS,
  buffGainSignals,
  canonicalAction,
  clusterSignals,
  directSkillSignals,
  effectSignals,
  hasNearbyAction,
  playerInstance,
  type MesmerActionIdentity,
  type MesmerSignal
} from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/shared.js';

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
const PRIMARY_EFFECT_DUPLICATE_WINDOW_MS = 10;
const CLONE_EFFECT_LIFECYCLE_WINDOW_MS = 2;
const MAXIMUM_SHATTER_SOURCE_TAIL_MS = 1000;
const KILLING_BLOW_RESULT = 8;

interface ShatterSignalSet {
  readonly signals: readonly MesmerSignal[];
  readonly shatterIds: ReadonlySet<number>;
  readonly maximumClusterSize?: number;
  readonly effectEvidence: boolean;
}

const RESOURCE_SHATTER_IDS: ReadonlySet<number> = new Set([
  SPLIT_SECOND.skillId,
  REWINDER.skillId,
  TIME_SINK.skillId,
  DISTORTION.skillId
]);

/**
 * Selects the evidence stream for one Chronomancer shatter, preferring effect-GUID signals for the whole log and
 * falling back to direct player skill packets only when no matching effect signal exists.
 */
function shatterSignals(
  context: EvtcProfessionReconstructionContext,
  guid: string,
  fallbackIds: readonly number[]
): ShatterSignalSet {
  const shatterIds = new Set(fallbackIds);
  const direct = directSkillSignals(context, shatterIds);
  const effects = effectSignals(context, guid);
  return effects.length
    ? { signals: effects, shatterIds, maximumClusterSize: MAXIMUM_SHATTER_SOURCES, effectEvidence: true }
    : { signals: direct, shatterIds, effectEvidence: false };
}

/**
 * Orders shatter signals and partitions them by the inter-signal gap and optional maximum number of Mesmer/clone
 * sources so the first signal in each group can represent one cast.
 */
function signalGroups(signalSet: ShatterSignalSet, gapMs: number): MesmerSignal[][] {
  const sorted = [...signalSet.signals].sort(
    (left, right) => left.event.time - right.event.time || left.eventIndex - right.eventIndex
  );
  const groups: MesmerSignal[][] = [];
  let previousTime = Number.NEGATIVE_INFINITY;
  for (const signal of sorted) {
    const current = groups[groups.length - 1];
    if (
      !current ||
      signal.event.time - previousTime > gapMs ||
      current.length >= (signalSet.maximumClusterSize ?? Number.POSITIVE_INFINITY)
    ) {
      groups.push([]);
    }

    groups[groups.length - 1]!.push(signal);
    previousTime = signal.event.time;
  }

  return groups;
}

/**
 * Removes one nearby effect signal for each skill-specific killing blow on the selected player's clones, falling back
 * to clone lifecycle ends for logs without that evidence so player-side shatter anchors remain intact.
 */
function effectsWithoutCloneLifecycleEnds(
  context: EvtcProfessionReconstructionContext,
  signalSet: ShatterSignalSet
): MesmerSignal[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [...signalSet.signals];
  const cloneAddresses = new Set(
    context.log.agents.filter((agent) => agent.character.trim().toLowerCase() === 'clone').map((agent) => agent.address)
  );
  const cloneShatterKills = context.log.events.filter(
    (event) =>
      event.result === KILLING_BLOW_RESULT &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === EVTC_ACTIVATION.NONE &&
      event.buff === 0 &&
      event.source === event.target &&
      cloneAddresses.has(event.source) &&
      event.sourceMasterInstance === ownerInstance &&
      signalSet.shatterIds.has(event.skillId)
  );
  const cloneEnds = (
    cloneShatterKills.length
      ? cloneShatterKills
      : context.log.events.filter(
          (event) =>
            cloneAddresses.has(event.source) &&
            event.sourceMasterInstance === ownerInstance &&
            (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT || event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD)
        )
  )
    .sort((left, right) => left.time - right.time)
    .filter(
      (event, index, events) =>
        !events
          .slice(0, index)
          .some(
            (earlier) =>
              earlier.source === event.source && Math.abs(earlier.time - event.time) <= CLONE_EFFECT_LIFECYCLE_WINDOW_MS
          )
    );
  const removed = new Set<number>();
  for (const cloneEnd of cloneEnds) {
    const match = signalSet.signals
      .map((signal, index) => ({ signal, index }))
      .filter(
        ({ signal, index }) =>
          !removed.has(index) && Math.abs(signal.event.time - cloneEnd.time) <= CLONE_EFFECT_LIFECYCLE_WINDOW_MS
      )
      .sort(
        (left, right) =>
          Math.abs(left.signal.event.time - cloneEnd.time) - Math.abs(right.signal.event.time - cloneEnd.time) ||
          right.index - left.index
      )[0];
    if (match) removed.add(match.index);
  }

  return signalSet.signals.filter((_, index) => !removed.has(index));
}

/**
 * Recovers a cast whose complete effect evidence was consumed by clone lifecycle matching while treating removed
 * signals within the source-tail window as additional clone sources for an already known cast.
 */
function lifecycleOnlyShatterCastSignals(
  signals: readonly MesmerSignal[],
  primarySignals: readonly MesmerSignal[]
): MesmerSignal[] {
  const primarySet = new Set(primarySignals);
  const recovered: MesmerSignal[] = [];
  const knownCasts = [...primarySignals].sort(
    (left, right) => left.event.time - right.event.time || left.eventIndex - right.eventIndex
  );

  for (const signal of signals) {
    if (primarySet.has(signal)) continue;
    const previous = [...knownCasts, ...recovered]
      .filter((candidate) => candidate.event.time <= signal.event.time)
      .sort((left, right) => right.event.time - left.event.time || right.eventIndex - left.eventIndex)[0];
    if (previous && signal.event.time - previous.event.time <= MAXIMUM_SHATTER_SOURCE_TAIL_MS) continue;
    recovered.push(signal);
  }

  return recovered;
}

/**
 * Reduces direct or effect evidence to one trait-independent anchor per shatter input, including lifecycle-only casts
 * and the bounded four-source fallback used when clone matching removes every primary signal.
 */
function shatterCastSignals(
  context: EvtcProfessionReconstructionContext,
  signalSet: ShatterSignalSet,
  gapMs: number
): MesmerSignal[] {
  if (!signalSet.effectEvidence) {
    return signalGroups(signalSet, gapMs).map((signals) => signals[0]);
  }

  const primarySignals = effectsWithoutCloneLifecycleEnds(context, signalSet);
  if (primarySignals.length) {
    const lifecycleOnlyCasts = lifecycleOnlyShatterCastSignals(signalSet.signals, primarySignals);
    return clusterSignals([...primarySignals, ...lifecycleOnlyCasts], PRIMARY_EFFECT_DUPLICATE_WINDOW_MS);
  }

  return signalGroups(signalSet, gapMs).map((signals) => signals[0]);
}

/** Converts retained shatter anchors into canonical instant actions unless the action stream already has that cast. */
function actionsFromSignals(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  identity: MesmerActionIdentity,
  signalSet: ShatterSignalSet,
  gapMs: number
): EvtcRecordedRotationAction[] {
  return shatterCastSignals(context, signalSet, gapMs).flatMap((signal) =>
    hasNearbyAction(actions, identity, signal.event.time, 100)
      ? []
      : [canonicalAction(signal.eventIndex, signal.event.time, identity, signal.event.skillId, 'effect')]
  );
}

/**
 * Reconstructs Continuum Split from Time Anchored gains and manual Continuum Shift from removals that report enough
 * remaining duration to distinguish an early return from natural expiration.
 */
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

/**
 * Infers Mirror Images casts omitted during Continuum Split by learning its ordinary recharge from recorded casts and
 * placing missing uses between sufficiently close shatter pairs inside anomalously large cast gaps.
 */
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

/**
 * Adds Chronomancer shatters, Continuum transitions, and inferred Continuum-restored Mirror Images uses to the generic
 * Mesmer action stream.
 */
export function reconstructChronomancerActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions = [...recordedActions];
  actions.push(
    ...actionsFromSignals(
      context,
      actions,
      SPLIT_SECOND,
      shatterSignals(context, MESMER_EFFECT_GUIDS.chronomancerSplitSecond, [56925, 56930]),
      750
    )
  );
  actions.push(
    ...actionsFromSignals(
      context,
      actions,
      REWINDER,
      shatterSignals(context, MESMER_EFFECT_GUIDS.chronomancerRewinder, [REWINDER.skillId]),
      750
    )
  );
  actions.push(
    ...actionsFromSignals(
      context,
      actions,
      TIME_SINK,
      shatterSignals(context, MESMER_EFFECT_GUIDS.chronomancerTimeSink, [TIME_SINK.skillId]),
      750
    )
  );
  actions.push(...continuumActions(context, actions));
  actions.push(...missingMirrorImagesActions(actions));
  return actions;
}
