import { EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import {
  MESMER_EFFECT_GUIDS,
  buffGainSignals,
  canonicalAction,
  canonicalCast,
  castDuration,
  clusterSignals,
  combatStartTime,
  effectSignals,
  hasNearbyAction,
  normalized,
  playerInstance,
  selectedSkill,
  type MesmerSignal
} from './shared.js';

const UNSTABLE_BLADESTORM = Object.freeze({
  name: 'Unstable Bladestorm',
  skillId: 62607
});
const CHAOS_STORM = Object.freeze({ name: 'Chaos Storm', skillId: 10169 });
const PHASE_RETREAT = Object.freeze({ name: 'Phase Retreat', skillId: 10310 });
const CHAOS_ARMOR = Object.freeze({ name: 'Chaos Armor', skillId: 10331 });
const DISTORTION = Object.freeze({ name: 'Distortion', skillId: 10192 });
const MIRROR_IMAGES = Object.freeze({ name: 'Mirror Images', skillId: 10202 });
const SIGNET_OF_MIDNIGHT = Object.freeze({
  name: 'Signet of Midnight',
  skillId: 10234
});
const MIMIC = Object.freeze({ name: 'Mimic', skillId: 29578 });

const CHAOS_AURA_BUFF = 10332;
const DISTORTION_BUFF = 10243;
const TIME_ANCHORED_BUFF = 30136;
const STAFF_CLONE_SPECIES = 8111;
const MIRAGE_INITIAL_CHAOS_AURA_DUPLICATE_WINDOW_MS = 1500;
const MIRAGE_PRE_SWAP_STAFF_ACTION_WINDOW_MS = 1500;

function firstOwnedAgentSignals(context: EvtcProfessionReconstructionContext, speciesId: number): MesmerSignal[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const speciesByAddress = new Map(context.log.agents.map((agent) => [agent.address, agent.profession]));
  const firstByAddress = new Map<bigint, MesmerSignal>();
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source === context.playerAddress ||
      event.sourceMasterInstance !== ownerInstance ||
      speciesByAddress.get(event.source) !== speciesId
    ) {
      return;
    }

    const current = firstByAddress.get(event.source);
    if (!current || event.time < current.event.time) {
      firstByAddress.set(event.source, { event, eventIndex });
    }
  });
  return [...firstByAddress.values()].sort(
    (left, right) => left.event.time - right.event.time || left.eventIndex - right.eventIndex
  );
}

function missingUnstableBladestormActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const missiles = context.log.events.flatMap((event, eventIndex) =>
    event.source === context.playerAddress && event.skillId === UNSTABLE_BLADESTORM.skillId && event.stateChange === 57
      ? [{ event, eventIndex }]
      : []
  );
  return clusterSignals(missiles, 1500).flatMap((signal) =>
    hasNearbyAction(actions, UNSTABLE_BLADESTORM, signal.event.time, 2500)
      ? []
      : [canonicalCast(context, signal, UNSTABLE_BLADESTORM, signal.event.time, 'effect')]
  );
}

function missingChaosStormActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return effectSignals(context, MESMER_EFFECT_GUIDS.chaosStorm).flatMap((signal) =>
    hasNearbyAction(actions, CHAOS_STORM, signal.event.time, 2000)
      ? []
      : [canonicalCast(context, signal, CHAOS_STORM, signal.event.time, 'effect')]
  );
}

function phaseRetreatSignals(context: EvtcProfessionReconstructionContext): MesmerSignal[] {
  const cloneSpawns = firstOwnedAgentSignals(context, STAFF_CLONE_SPECIES);
  return effectSignals(context, MESMER_EFFECT_GUIDS.mesmerTeleport).filter((signal) =>
    cloneSpawns.some((spawn) => Math.abs(spawn.event.time - signal.event.time) <= 50)
  );
}

function phaseRetreatActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return phaseRetreatSignals(context).flatMap((signal) =>
    hasNearbyAction(actions, PHASE_RETREAT, signal.event.time, 100)
      ? []
      : [canonicalAction(signal.eventIndex, signal.event.time, PHASE_RETREAT, signal.event.skillId, 'effect')]
  );
}

function chaosArmorActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const isMirage = context.profile.specializationId === 'mirage';
  const phaseTimes = phaseRetreatSignals(context).map((signal) => signal.event.time);
  const chaosStormTimes = effectSignals(context, MESMER_EFFECT_GUIDS.chaosStorm).map((signal) => signal.event.time);
  // Mirage logs expose a precast Chaos Armor as initial aura state, then may repeat that aura packet;
  // preserve the opener while suppressing only its immediate duplicate.
  const auraSignals = buffGainSignals(context, CHAOS_AURA_BUFF, isMirage);
  const initialAuraTimes = auraSignals
    .filter((signal) => signal.event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL)
    .map((signal) => signal.event.time);
  return auraSignals
    .filter(
      (signal) =>
        (signal.event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ||
          !initialAuraTimes.some(
            (time) =>
              signal.event.time > time && signal.event.time - time <= MIRAGE_INITIAL_CHAOS_AURA_DUPLICATE_WINDOW_MS
          )) &&
        !phaseTimes.some((time) => Math.abs(time - signal.event.time) <= 30) &&
        !chaosStormTimes.some((time) => {
          const delay = signal.event.time - time;
          return delay >= 3000 && delay <= 5500;
        })
    )
    .flatMap((signal) => {
      const recentSwap = isMirage
        ? actions
            .filter(
              (action) =>
                (action.canonicalSkillId === -3 ||
                  normalized(action.canonicalName || action.rawName) === 'swap weapons') &&
                action.start < signal.event.time &&
                signal.event.time - action.start <= 1500
            )
            .sort((left, right) => right.start - left.start)[0]
        : null;
      const priorStaffAction = recentSwap
        ? actions
            .filter(
              (action) =>
                (action.rawSkillId === CHAOS_STORM.skillId ||
                  action.canonicalSkillId === CHAOS_STORM.skillId ||
                  action.rawSkillId === PHASE_RETREAT.skillId ||
                  action.canonicalSkillId === PHASE_RETREAT.skillId) &&
                action.start < recentSwap.start
            )
            .sort((left, right) => right.start - left.start)[0]
        : null;
      const priorStaffActionEnd = priorStaffAction
        ? Math.max(priorStaffAction.end, priorStaffAction.start)
        : Number.NEGATIVE_INFINITY;
      // Mirage aura packets can arrive just after swapping away from Staff; only move the cast before
      // that swap when a Staff action immediately preceded it, otherwise preserve a new Staff-side cast.
      const delayedPreSwapAura =
        recentSwap &&
        priorStaffAction &&
        recentSwap.start - priorStaffActionEnd <= MIRAGE_PRE_SWAP_STAFF_ACTION_WINDOW_MS;
      const actionTime = delayedPreSwapAura
        ? Math.min(recentSwap!.start, Math.max(priorStaffAction.end, priorStaffAction.start))
        : signal.event.time;
      return hasNearbyAction(actions, CHAOS_ARMOR, actionTime, 100)
        ? []
        : [
            canonicalAction(
              signal.eventIndex,
              actionTime,
              CHAOS_ARMOR,
              signal.event.skillId,
              signal.event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ? 'initial-state' : 'buff-transition',
              signal.event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL ? { initialState: true, precast: true } : {}
            )
          ];
    });
}

function distortionActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId === 'virtuoso' || context.profile.specializationId === 'troubadour') {
    return [];
  }

  return clusterSignals(buffGainSignals(context, DISTORTION_BUFF), 500).flatMap((signal) =>
    hasNearbyAction(actions, DISTORTION, signal.event.time, 100)
      ? []
      : [canonicalAction(signal.eventIndex, signal.event.time, DISTORTION, signal.event.skillId, 'buff-transition')]
  );
}

function mirrorImagesActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const phaseRetreatTimes = phaseRetreatSignals(context).map((signal) => signal.event.time);
  const spawnsByTime = new Map<number, MesmerSignal[]>();
  for (const signal of firstOwnedAgentSignals(context, STAFF_CLONE_SPECIES)) {
    spawnsByTime.set(signal.event.time, [...(spawnsByTime.get(signal.event.time) || []), signal]);
  }

  const pairs = [...spawnsByTime.values()].filter(
    (signals) => signals.length >= 2 && !phaseRetreatTimes.some((time) => Math.abs(time - signals[0].event.time) <= 50)
  );
  const selected = selectedSkill(context, MIRROR_IMAGES);
  if (selected === false || (selected == null && pairs.length < 2)) return [];
  return pairs.flatMap((signals) => {
    const signal = signals[0];
    return hasNearbyAction(actions, MIRROR_IMAGES, signal.event.time, 100)
      ? []
      : [
          canonicalAction(
            signal.eventIndex,
            signal.event.time,
            MIRROR_IMAGES,
            MIRROR_IMAGES.skillId,
            'resource-inference'
          )
        ];
  });
}

function signetOfMidnightActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const manualShiftTimes = context.log.events
    .filter(
      (event) =>
        event.source === context.playerAddress &&
        event.skillId === TIME_ANCHORED_BUFF &&
        event.buff !== 0 &&
        event.buffRemove === 3 &&
        Math.max(event.value, event.buffDamage) > 150
    )
    .map((event) => event.time);
  return effectSignals(context, MESMER_EFFECT_GUIDS.signetOfMidnight).flatMap((signal) => {
    const restoredByContinuum = manualShiftTimes.some((time) => {
      const delay = signal.event.time - time;
      return delay > 0 && delay <= 2000;
    });
    if (restoredByContinuum || hasNearbyAction(actions, SIGNET_OF_MIDNIGHT, signal.event.time, 100)) {
      return [];
    }

    return [canonicalAction(signal.eventIndex, signal.event.time, SIGNET_OF_MIDNIGHT, signal.event.skillId, 'effect')];
  });
}

function inferredOpeningMimic(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const selected = selectedSkill(context, MIMIC);
  if (selected === false) return [];
  const recorded = actions
    .filter(
      (action) =>
        action.rawSkillId === MIMIC.skillId ||
        action.canonicalSkillId === MIMIC.skillId ||
        normalized(action.rawName) === normalized(MIMIC.name)
    )
    .sort((left, right) => left.start - right.start);
  const combatStart = combatStartTime(context);
  if (
    combatStart == null ||
    recorded.length < 2 ||
    recorded[0].start - combatStart < 12_000 ||
    recorded[1].start - recorded[0].start > 45_000
  ) {
    return [];
  }

  const duration = castDuration(context, MIMIC);
  return [
    canonicalAction(recorded[0].eventIndex - 1, combatStart - duration, MIMIC, MIMIC.skillId, 'initial-state', {
      end: combatStart,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    })
  ];
}

export function addMesmerCommonActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const actions = [...recordedActions];
  actions.push(...missingUnstableBladestormActions(context, actions));
  actions.push(...missingChaosStormActions(context, actions));
  actions.push(...phaseRetreatActions(context, actions));
  actions.push(...chaosArmorActions(context, actions));
  actions.push(...distortionActions(context, actions));
  actions.push(...mirrorImagesActions(context, actions));
  actions.push(...signetOfMidnightActions(context, actions));
  actions.push(...inferredOpeningMimic(context, actions));
  return actions;
}
