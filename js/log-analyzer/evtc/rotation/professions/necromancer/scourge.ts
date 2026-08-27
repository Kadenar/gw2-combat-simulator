import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import { findRotationSkill } from '../../catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { effectAction, hasRecordedAction, INSTANT_SIGNAL_WINDOW_MS } from './shared.js';

const MANIFEST_SAND_SHADE = Object.freeze({
  name: 'Manifest Sand Shade',
  skillId: 44946
});
const NEFARIOUS_FAVOR = Object.freeze({
  name: 'Nefarious Favor',
  skillId: 40813
});
const SAND_CASCADE = Object.freeze({
  name: 'Sand Cascade',
  skillId: 43448
});
const GARISH_PILLAR = Object.freeze({
  name: 'Garish Pillar',
  skillId: 44428
});
const DESERT_SHROUD = Object.freeze({
  name: 'Desert Shroud',
  skillId: 44663
});
const BLOOD_IS_POWER = Object.freeze({
  name: 'Blood Is Power',
  skillId: 10544
});
const HAUNT = Object.freeze({ name: 'Haunt', skillId: 10590 });

const FEAR_BUFF = 791;
const SHADOW_FIEND_SPECIES_ID = 5673;
const HAUNT_ANIMATION_SIGNAL = 3643;
const SAND_SHADE_INITIAL_BUFF = 45079;
const NEFARIOUS_FAVOR_SIGNAL = 46808;
const DESERT_SHROUD_PULSE_SIGNAL = 46726;
const DESERT_SHROUD_PULSE_WINDOW_MS = 1500;

function playerInstance(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find((event) => event.source === context.playerAddress && event.sourceInstance > 0)
      ?.sourceInstance ?? null
  );
}

function recordedDuration(
  context: EvtcProfessionReconstructionContext,
  identity: { readonly name: string; readonly skillId: number }
): number {
  const normalizedName = identity.name.toLowerCase();
  const durations = context.recordedActions
    .filter(
      (action) =>
        action.status === 'completed' &&
        action.end > action.start &&
        (action.rawSkillId === identity.skillId || action.rawName.trim().toLowerCase() === normalizedName)
    )
    .map((action) => action.end - action.start)
    .sort((left, right) => left - right);
  if (durations.length) return durations[Math.floor(durations.length / 2)];
  const skill = findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
  return Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
}

function initialManifestSandShadeActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const initial = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.target === context.playerAddress &&
        event.skillId === SAND_SHADE_INITIAL_BUFF &&
        event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
        event.buffDamage > event.value
    )
    .sort((left, right) => left.event.time - right.event.time)[0];
  if (!initial) return [];

  // BUFF_INITIAL stores the full and remaining shade lifetime. Their
  // difference is the age of the shade at the first EVTC snapshot.
  const start = initial.event.time - (initial.event.buffDamage - initial.event.value);
  if (
    hasRecordedAction(context, MANIFEST_SAND_SHADE.skillId, MANIFEST_SAND_SHADE.name, start, INSTANT_SIGNAL_WINDOW_MS)
  ) {
    return [];
  }

  const duration = recordedDuration(context, MANIFEST_SAND_SHADE);
  return [
    {
      ...effectAction(
        initial.eventIndex,
        start,
        initial.event.skillId,
        MANIFEST_SAND_SHADE.name,
        MANIFEST_SAND_SHADE,
        'initial-state'
      ),
      end: start + duration,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    }
  ];
}

function truncatedBloodIsPowerActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const firstPlayerEventTime = Math.min(
    ...context.log.events
      .filter(
        (event) => event.time > 0 && (event.source === context.playerAddress || event.target === context.playerAddress)
      )
      .map((event) => event.time)
  );
  if (!Number.isFinite(firstPlayerEventTime)) return [];

  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== BLOOD_IS_POWER.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }

    const start = event.time - event.value;
    const alreadyRecorded = context.recordedActions.some(
      (action) => action.rawSkillId === event.skillId && Math.abs(action.end - event.time) <= INSTANT_SIGNAL_WINDOW_MS
    );
    if (alreadyRecorded || start > firstPlayerEventTime) return [];
    return [
      {
        ...effectAction(eventIndex, start, event.skillId, BLOOD_IS_POWER.name, BLOOD_IS_POWER, 'animation'),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: 'completed' as const,
        precast: true
      }
    ];
  });
}

function hauntActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const shadowFiends = new Set(
    context.log.agents.filter((agent) => agent.profession === SHADOW_FIEND_SPECIES_ID).map((agent) => agent.address)
  );
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      !shadowFiends.has(event.source) ||
      event.sourceMasterInstance !== ownerInstance ||
      event.skillId !== HAUNT_ANIMATION_SIGNAL ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_START
    ) {
      return [];
    }

    return [effectAction(eventIndex, event.time, event.skillId, HAUNT.name, HAUNT, 'animation')];
  });
}

function nefariousFavorActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== NEFARIOUS_FAVOR_SIGNAL ||
      event.buff !== 0 ||
      hasRecordedAction(context, NEFARIOUS_FAVOR.skillId, NEFARIOUS_FAVOR.name, event.time, INSTANT_SIGNAL_WINDOW_MS) ||
      actions.some((action) => Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS)
    ) {
      return;
    }

    actions.push(effectAction(eventIndex, event.time, event.skillId, NEFARIOUS_FAVOR.name, NEFARIOUS_FAVOR));
  });
  return actions;
}

function desertShroudActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  let previousPulse: number | null = null;
  context.log.events.forEach((event, eventIndex) => {
    if (event.source !== context.playerAddress || event.skillId !== DESERT_SHROUD_PULSE_SIGNAL || event.buff !== 0) {
      return;
    }

    const beginsActivation = previousPulse == null || event.time - previousPulse > DESERT_SHROUD_PULSE_WINDOW_MS;
    previousPulse = event.time;
    if (!beginsActivation) return;
    actions.push(effectAction(eventIndex, event.time, event.skillId, DESERT_SHROUD.name, DESERT_SHROUD));
  });
  return actions;
}

function sandCascadeActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== SAND_CASCADE.skillId ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.stateChange === EVTC_STATE_CHANGE.NONE && event.value <= 0 && event.buffDamage <= 0) ||
      hasRecordedAction(context, SAND_CASCADE.skillId, SAND_CASCADE.name, event.time, INSTANT_SIGNAL_WINDOW_MS) ||
      actions.some((action) => Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS)
    ) {
      return;
    }

    actions.push(effectAction(eventIndex, event.time, event.skillId, SAND_CASCADE.name, SAND_CASCADE));
  });
  return actions;
}

function garishPillarActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  context.log.events.forEach((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== FEAR_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY ||
      Math.max(event.value, event.buffDamage) !== 1000 ||
      hasRecordedAction(context, GARISH_PILLAR.skillId, GARISH_PILLAR.name, event.time, INSTANT_SIGNAL_WINDOW_MS) ||
      actions.some((action) => Math.abs(action.start - event.time) <= INSTANT_SIGNAL_WINDOW_MS)
    ) {
      return;
    }

    actions.push(effectAction(eventIndex, event.time, event.skillId, GARISH_PILLAR.name, GARISH_PILLAR));
  });
  return actions;
}

export function reconstructScourgeActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  return [
    ...context.recordedActions,
    ...initialManifestSandShadeActions(context),
    ...truncatedBloodIsPowerActions(context),
    ...hauntActions(context),
    ...nefariousFavorActions(context),
    ...sandCascadeActions(context),
    ...garishPillarActions(context),
    ...desertShroudActions(context)
  ];
}
