import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
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

const GRASPING_DARKNESS = Object.freeze({
  name: 'Grasping Darkness',
  skillId: 29740
});
const NIGHTFALL = Object.freeze({ name: 'Nightfall', skillId: 29855 });
const EXIT_REAPERS_SHROUD = Object.freeze({
  name: "Exit Reaper's Shroud",
  skillId: 30961
});
const GRASPING_DARKNESS_PRECAST_COMMIT_MS = 120;

export const REAPER_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: 29446,
    gain: { name: "Reaper's Shroud", skillId: 30792 },
    loss: EXIT_REAPERS_SHROUD,
    suppressWeaponSwap: true
  }
];

function truncatedReaperPrecastActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const firstPlayerEventTime = Math.min(
    ...context.log.events
      .filter(
        (event) => event.time > 0 && (event.source === context.playerAddress || event.target === context.playerAddress)
      )
      .map((event) => event.time)
  );
  if (!Number.isFinite(firstPlayerEventTime)) return [];

  const nightfallStop = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === NIGHTFALL.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
        (event.activation === EVTC_ACTIVATION.CANCEL_FIRE || event.activation === EVTC_ACTIVATION.RESET) &&
        event.value > 0
    )
    .sort((left, right) => left.event.time - right.event.time)[0];
  if (!nightfallStop) return [];
  const nightfallStart = nightfallStop.event.time - nightfallStop.event.value;
  const nightfallRecorded = context.recordedActions.some(
    (action) =>
      action.rawSkillId === NIGHTFALL.skillId &&
      Math.abs(action.end - nightfallStop.event.time) <= INSTANT_SIGNAL_WINDOW_MS
  );
  if (nightfallRecorded || nightfallStart > firstPlayerEventTime) return [];

  const actions: EvtcRecordedRotationAction[] = [
    {
      ...effectAction(
        nightfallStop.eventIndex,
        nightfallStart,
        nightfallStop.event.skillId,
        NIGHTFALL.name,
        NIGHTFALL,
        'animation'
      ),
      end: nightfallStop.event.time,
      expectedDuration: Math.max(nightfallStop.event.value, nightfallStop.event.buffDamage),
      status: 'completed',
      precast: true
    }
  ];

  const graspingSignal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === GRASPING_DARKNESS.skillId &&
        event.time <= nightfallStop.event.time &&
        event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_START &&
        event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP
    )
    .sort((left, right) => left.event.time - right.event.time)[0];
  if (!graspingSignal) return actions;
  const graspingStart = nightfallStart - GRASPING_DARKNESS_PRECAST_COMMIT_MS;
  if (
    hasRecordedAction(
      context,
      GRASPING_DARKNESS.skillId,
      GRASPING_DARKNESS.name,
      graspingStart,
      INSTANT_SIGNAL_WINDOW_MS
    )
  ) {
    return actions;
  }

  const graspingSkill = findRotationSkill(
    GRASPING_DARKNESS.skillId,
    GRASPING_DARKNESS.name,
    context.catalog,
    context.profile
  );
  actions.push({
    ...effectAction(
      graspingSignal.eventIndex,
      graspingStart,
      graspingSignal.event.skillId,
      GRASPING_DARKNESS.name,
      GRASPING_DARKNESS
    ),
    end: nightfallStart,
    expectedDuration: Math.max(
      GRASPING_DARKNESS_PRECAST_COMMIT_MS,
      Number(graspingSkill?.quicknessCastTimeMs || graspingSkill?.castTimeMs || 0)
    ),
    status: 'interrupted',
    precast: true
  });
  return actions;
}

function encounterEndTime(context: EvtcProfessionReconstructionContext): number | null {
  const targets = new Set(
    context.log.agents
      .filter((agent) => agent.profession === context.log.header.encounterId)
      .map((agent) => agent.address)
  );
  const times = context.log.events
    .filter(
      (event) =>
        targets.has(event.source) &&
        (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT || event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD)
    )
    .map((event) => event.time);
  return times.length ? Math.min(...times) : null;
}

function removePostEncounterReaperExit(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context);
  if (encounterEnd == null) return [...actions];
  return actions.filter(
    (action) =>
      !(
        (action.rawSkillId === EXIT_REAPERS_SHROUD.skillId || action.rawName === EXIT_REAPERS_SHROUD.name) &&
        action.start > encounterEnd
      )
  );
}

export function reconstructReaperActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  return removePostEncounterReaperExit(context, [
    ...context.recordedActions,
    ...truncatedReaperPrecastActions(context)
  ]);
}
