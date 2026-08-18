import type { EvtcRotationBuffTransition } from '../../profiles.js';
import { EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { detectedWarriorCorePrecast, WARRIOR_CORE_ACTIONS } from './common.js';
import {
  hasActionNear,
  instantAction,
  isBuffApplication,
  playerInitialBuff,
  sequentialInitialActions,
  SIGNAL_WINDOW_MS,
  type WarriorActionIdentity
} from './shared.js';

const UNSHEATHE_GUNSABER = Object.freeze({
  name: 'Unsheathe Gunsaber',
  skillId: 62745
});
const SHEATHE_GUNSABER = Object.freeze({
  name: 'Sheathe Gunsaber',
  skillId: 62861
});
const BREAK_STEP = Object.freeze({ name: 'Break Step', skillId: 62885 });
const OVERCHARGED_CARTRIDGES = Object.freeze({
  name: 'Overcharged Cartridges',
  skillId: 68085
});
const FLOW_STABILIZER = Object.freeze({
  name: 'Flow Stabilizer',
  skillId: 62967
});
const TACTICAL_RELOAD = Object.freeze({
  name: 'Tactical Reload',
  skillId: 62901
});
const DRAGONS_ROAR = Object.freeze({
  name: "Dragon's Roar",
  skillId: 62800
});
const DRAGON_TRIGGER = Object.freeze({
  name: 'Dragon Trigger',
  skillId: 62803
});
const FLICKER_STEP = Object.freeze({ name: 'Flicker Step', skillId: 62926 });
const TRIGGERGUARD = Object.freeze({ name: 'Triggerguard', skillId: 62893 });

const GUNSABER_MODE_BUFF = 62769;
const POSITIVE_FLOW_BUFF = 62836;
const TACTICAL_RELOAD_BUFF = 68126;
const SUPERCHARGED_CARTRIDGES_BUFF = 76513;
const AEGIS_BUFF = 743;
const RELIC_OF_PEITHA = 70196;
const POSITIVE_FLOW_DURATION_MS = 8_000;
const TRIGGERGUARD_AEGIS_DURATION_MS = 2_000;
const PEITHA_EFFECT_STATE_CHANGE = 57;
const PEITHA_TRIGGER_GRACE_MS = 500;

export const BLADESWORN_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: GUNSABER_MODE_BUFF,
    gain: UNSHEATHE_GUNSABER,
    loss: SHEATHE_GUNSABER,
    suppressWeaponSwap: true
  }
];

function initialBuffCount(context: EvtcProfessionReconstructionContext, skillId: number): number {
  return context.log.events.filter(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === skillId &&
      event.buff !== 0 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
  ).length;
}

function bladeswornPrecasts(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const firstTrigger = actions
    .filter(
      (action) => action.rawSkillId === DRAGON_TRIGGER.skillId || action.canonicalSkillId === DRAGON_TRIGGER.skillId
    )
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex)[0];
  const hasInitialSequence =
    initialBuffCount(context, POSITIVE_FLOW_BUFF) >= 4 &&
    playerInitialBuff(context, TACTICAL_RELOAD_BUFF) &&
    playerInitialBuff(context, SUPERCHARGED_CARTRIDGES_BUFF) &&
    detectedWarriorCorePrecast(context, 'mending');
  if (!firstTrigger || !hasInitialSequence) return [];

  const identities: readonly WarriorActionIdentity[] = [
    UNSHEATHE_GUNSABER,
    BREAK_STEP,
    SHEATHE_GUNSABER,
    OVERCHARGED_CARTRIDGES,
    FLOW_STABILIZER,
    TACTICAL_RELOAD,
    WARRIOR_CORE_ACTIONS.mending,
    FLOW_STABILIZER,
    OVERCHARGED_CARTRIDGES,
    DRAGONS_ROAR
  ];
  return sequentialInitialActions(context, identities, firstTrigger.start, -4000);
}

function removeAutomaticDragonTriggerUnsheathes(
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const triggers = actions.filter(
    (action) => action.rawSkillId === DRAGON_TRIGGER.skillId || action.canonicalSkillId === DRAGON_TRIGGER.skillId
  );
  return actions.filter(
    (action) =>
      !(
        (action.rawSkillId === UNSHEATHE_GUNSABER.skillId || action.canonicalSkillId === UNSHEATHE_GUNSABER.skillId) &&
        triggers.some((trigger) => Math.abs(trigger.start - action.start) <= SIGNAL_WINDOW_MS)
      )
  );
}

function flowStabilizerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const signals = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target === context.playerAddress &&
        event.skillId === POSITIVE_FLOW_BUFF &&
        event.buff !== 0 &&
        event.buffRemove === 0 &&
        isBuffApplication(event.stateChange) &&
        Math.max(event.value, event.buffDamage) === POSITIVE_FLOW_DURATION_MS
    )
    .sort((left, right) => left.event.time - right.event.time);
  const groups: (typeof signals)[] = [];
  for (const signal of signals) {
    const current = groups.at(-1);
    if (!current || signal.event.time - current[0].event.time > SIGNAL_WINDOW_MS) {
      groups.push([signal]);
    } else {
      current.push(signal);
    }
  }
  return groups.flatMap((group) => {
    const signal = group[0];
    if (group.length < 2 || hasActionNear(actions, FLOW_STABILIZER, signal.event.time)) {
      return [];
    }
    return [
      instantAction(signal.eventIndex, signal.event.time, signal.event.skillId, 'Positive Flow', FLOW_STABILIZER)
    ];
  });
}

function triggerguardActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== AEGIS_BUFF ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      !isBuffApplication(event.stateChange) ||
      Math.max(event.value, event.buffDamage) !== TRIGGERGUARD_AEGIS_DURATION_MS ||
      hasActionNear(actions, TRIGGERGUARD, event.time)
    ) {
      return [];
    }
    return [instantAction(eventIndex, event.time, event.skillId, 'Aegis', TRIGGERGUARD)];
  });
}

function flickerStepActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const triggers = actions
    .filter(
      (action) => action.rawSkillId === DRAGON_TRIGGER.skillId || action.canonicalSkillId === DRAGON_TRIGGER.skillId
    )
    .sort((left, right) => left.start - right.start);
  const used = new Set<EvtcRecordedRotationAction>();
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== RELIC_OF_PEITHA ||
      event.stateChange !== PEITHA_EFFECT_STATE_CHANGE
    ) {
      return [];
    }
    const trigger = [...triggers]
      .reverse()
      .find((candidate) => candidate.start <= event.time && event.time <= candidate.end + PEITHA_TRIGGER_GRACE_MS);
    if (!trigger || used.has(trigger)) return [];
    used.add(trigger);
    const time = Math.min(event.time, Math.max(trigger.start, trigger.end - 1));
    if (hasActionNear(actions, FLICKER_STEP, time)) return [];
    return [instantAction(eventIndex, time, event.skillId, 'Relic of Peitha', FLICKER_STEP)];
  });
}

export function reconstructBladeswornActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const normalized = removeAutomaticDragonTriggerUnsheathes(actions);
  return [
    ...bladeswornPrecasts(context, normalized),
    ...normalized,
    ...flowStabilizerActions(context, normalized),
    ...triggerguardActions(context, normalized),
    ...flickerStepActions(context, normalized)
  ];
}
