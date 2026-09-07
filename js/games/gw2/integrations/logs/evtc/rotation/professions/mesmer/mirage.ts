import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
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
  selectedSkill,
  type MesmerActionIdentity,
  type MesmerSignal
} from '#gw2/integrations/logs/evtc/rotation/professions/mesmer/shared.js';

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
const ILLUSIONARY_AMBUSH = Object.freeze({ name: 'Illusionary Ambush', skillId: 45046 });
const AXES_OF_SYMMETRY = Object.freeze({ name: 'Axes of Symmetry', skillId: 43761 });
const JAUNT = Object.freeze({ name: 'Jaunt', skillId: 45449 });

/**
 * Selects and clusters the primary evidence for one Mirage shatter, preferring direct player damage over the effect
 * GUID so clone damage cannot create duplicate input actions.
 */
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

/**
 * Reconstructs Cry of Frustration, Mind Wrack, and Diversion from their authoritative signals while rejecting
 * Diversion effects that overlap a recent shatter and suppressing actions already present in the stream.
 */
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

/**
 * Matches ground-mirror removal to its owned creation so a nearby cloak gain identifies a pickup, not a dodge at
 * spawn time. Clear tracking IDs on every creation/removal because the log can reuse them for unrelated effects.
 */
function mirrorRemovalSignals(context: EvtcProfessionReconstructionContext): MesmerSignal[] {
  const creations = new Set(effectSignals(context, MESMER_EFFECT_GUIDS.mirageMirror).map(({ event }) => event));
  const active = new Set<number>();
  const signals: MesmerSignal[] = [];
  for (const [eventIndex, event] of context.log.events.entries()) {
    if (event.stateChange !== 60 && event.stateChange !== 61) continue;
    if (event.pad === 0) continue;
    if (event.stateChange === 60) {
      if (creations.has(event)) active.add(event.pad);
      else active.delete(event.pad);
    } else if (active.delete(event.pad)) {
      signals.push({ event, eventIndex });
    }
  }

  return signals;
}

/**
 * Separates dodges, mirror pickups, and Illusionary Ambush using removal, damage, and teleport evidence; preserves
 * initial cloak as a precast and leaves the longer Dune Cloak gain to its recorded shatter.
 */
function mirageCloakActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  // Removal covers pickups outside damage range; direct damage also supports logs without tracked ground effects.
  const mirrorSignals = [
    ...mirrorRemovalSignals(context),
    ...directSkillSignals(context, new Set([MIRAGE_MIRROR_DAMAGE]))
  ];
  // Illusionary Ambush grants cloak without an animation. Its teleport effect is shared with Jaunt and Axes of
  // Symmetry, so reject those recorded inputs before attributing an otherwise unmatched cloak to the utility.
  const teleportSignals =
    selectedSkill(context, ILLUSIONARY_AMBUSH) === false
      ? []
      : effectSignals(context, MESMER_EFFECT_GUIDS.mirageTeleport);
  const jauntSignals = directSkillSignals(context, new Set([JAUNT.skillId]));

  return buffGainSignals(context, MIRAGE_CLOAK_BUFF, true)
    .filter(
      (signal) =>
        signal.event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ||
        Math.max(signal.event.value, signal.event.buffDamage) <= 900
    )
    .flatMap((signal) => {
      const mirror = mirrorSignals.some((candidate) => Math.abs(candidate.event.time - signal.event.time) <= 50);
      const teleport = teleportSignals.some((candidate) => Math.abs(candidate.event.time - signal.event.time) <= 50);
      const otherTeleport =
        jauntSignals.some((candidate) => Math.abs(candidate.event.time - signal.event.time) <= 100) ||
        hasNearbyAction(actions, JAUNT, signal.event.time, 100) ||
        actions.some(
          (action) =>
            (action.canonicalSkillId ?? action.rawSkillId) === AXES_OF_SYMMETRY.skillId &&
            signal.event.time >= action.start - 100 &&
            signal.event.time <= action.end + 100
        );
      const identity = mirror ? PICK_UP_MIRAGE_MIRROR : teleport && !otherTeleport ? ILLUSIONARY_AMBUSH : DODGE;
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

/** Adds Mirage shatters and Mirage Cloak resource actions to the generic Mesmer action stream. */
export function reconstructMirageActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions = [...recordedActions];
  actions.push(...shatterActions(context, actions));
  actions.push(...mirageCloakActions(context, actions));
  return actions;
}
