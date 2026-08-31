import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import type { EvtcRotationBuffTransition } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  directAction,
  firstPlayerEventTime,
  rangerSkill,
  rawSkillName
} from '#gw2/integrations/logs/evtc/rotation/professions/ranger/shared.js';

const CELESTIAL_AVATAR_BUFF = 31508;
const CELESTIAL_AVATAR = Object.freeze({
  name: 'Celestial Avatar',
  skillId: 31869
});
const RELEASE_CELESTIAL_AVATAR = Object.freeze({
  name: 'Release Celestial Avatar',
  skillId: 31411
});
const NATURAL_CONVERGENCE = Object.freeze({
  name: 'Natural Convergence',
  skillId: 31503
});
const SEED_OF_LIFE = Object.freeze({ name: 'Seed of Life', skillId: 31406 });
const VIPERS_NEST = Object.freeze({ name: "Viper's Nest", skillId: 12496 });
const DODGE = Object.freeze({ name: 'Dodge', skillId: -5 });
const LIGHT_ON_YOUR_FEET = 30673;

const TRANSITION_WINDOW_MS = 150;
const SEED_CHANNEL_OFFSET_MS = 600;

function isAction(action: EvtcRecordedRotationAction, skillId: number): boolean {
  return action.rawSkillId === skillId || action.canonicalSkillId === skillId;
}

export const DRUID_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: CELESTIAL_AVATAR_BUFF,
    gain: CELESTIAL_AVATAR,
    suppressWeaponSwap: true
  }
];

function truncatedNaturalConvergence(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const firstEventTime = firstPlayerEventTime(context);
  if (firstEventTime == null) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== NATURAL_CONVERGENCE.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }

    const start = event.time - event.value;
    const recorded = actions.some(
      (action) => action.rawSkillId === event.skillId && Math.abs(action.end - event.time) <= TRANSITION_WINDOW_MS
    );
    if (recorded || start >= firstEventTime) return [];
    return [
      {
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          rawSkillName(context, event.skillId),
          NATURAL_CONVERGENCE,
          'initial-state'
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: 'completed' as const,
        precast: true
      }
    ];
  });
}

function avatarExitActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const seen = new Set<number>();
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== CELESTIAL_AVATAR_BUFF ||
      event.buff === 0 ||
      event.buffRemove === 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE &&
        event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_ALL) ||
      seen.has(event.time)
    ) {
      return [];
    }

    seen.add(event.time);
    return [
      directAction(
        eventIndex,
        event.time,
        event.skillId,
        rawSkillName(context, event.skillId),
        RELEASE_CELESTIAL_AVATAR,
        'buff-transition'
      )
    ];
  });
}

function alignInitialAvatar(actions: readonly EvtcRecordedRotationAction[]): EvtcRecordedRotationAction[] {
  const firstNatural = actions
    .filter((action) => isAction(action, NATURAL_CONVERGENCE.skillId) && action.precast === true)
    .sort((left, right) => left.start - right.start)[0];
  if (!firstNatural) return [...actions];
  return actions.map((action) =>
    isAction(action, CELESTIAL_AVATAR.skillId) && action.initialState === true && action.start > firstNatural.start
      ? { ...action, start: firstNatural.start, end: firstNatural.start }
      : action
  );
}

function removeAvatarWeaponSwaps(actions: readonly EvtcRecordedRotationAction[]): EvtcRecordedRotationAction[] {
  const transitions = actions.filter(
    (action) => isAction(action, CELESTIAL_AVATAR.skillId) || isAction(action, RELEASE_CELESTIAL_AVATAR.skillId)
  );
  return actions.filter(
    (action) =>
      action.rawName !== 'Swap Weapons' ||
      !transitions.some((transition) => Math.abs(transition.start - action.start) <= TRANSITION_WINDOW_MS)
  );
}

function initialVipersNest(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const firstEventTime = firstPlayerEventTime(context);
  if (
    firstEventTime == null ||
    actions.some((action) => isAction(action, VIPERS_NEST.skillId) && action.start <= firstEventTime)
  ) {
    return [];
  }

  const signal = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === VIPERS_NEST.skillId &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0 &&
        event.time >= firstEventTime &&
        event.time - firstEventTime <= 1000
    );
  if (!signal) return [];
  const anchor = actions.length ? Math.min(...actions.map((action) => action.start)) : firstEventTime;
  return [
    directAction(signal.eventIndex, anchor - 1, signal.event.skillId, VIPERS_NEST.name, VIPERS_NEST, 'initial-state', {
      precast: true
    })
  ];
}

function seedOfLifeActions(actions: readonly EvtcRecordedRotationAction[]): EvtcRecordedRotationAction[] {
  const entries = actions
    .filter((action) => isAction(action, CELESTIAL_AVATAR.skillId))
    .sort((left, right) => left.start - right.start);
  const exits = actions
    .filter((action) => isAction(action, RELEASE_CELESTIAL_AVATAR.skillId))
    .sort((left, right) => left.start - right.start);
  return entries.flatMap((entry, entryIndex) => {
    const nextEntry = entries[entryIndex + 1]?.start ?? Number.POSITIVE_INFINITY;
    const exit = exits.find((candidate) => candidate.start >= entry.start && candidate.start < nextEntry);
    if (!exit) return [];
    const natural = actions
      .filter(
        (action) =>
          isAction(action, NATURAL_CONVERGENCE.skillId) && action.start >= entry.start && action.start < exit.start
      )
      .sort((left, right) => left.start - right.start)[0];
    if (!natural) return [];
    const channelOffset = Math.min(SEED_CHANNEL_OFFSET_MS, Math.max(0, natural.end - natural.start));
    return [
      directAction(
        natural.eventIndex + 0.25,
        natural.start + channelOffset,
        SEED_OF_LIFE.skillId,
        SEED_OF_LIFE.name,
        SEED_OF_LIFE,
        'resource-inference'
      ),
      directAction(
        exit.eventIndex - 0.25,
        exit.start,
        SEED_OF_LIFE.skillId,
        SEED_OF_LIFE.name,
        SEED_OF_LIFE,
        'resource-inference'
      )
    ];
  });
}

function dodgeActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  let previous = Number.NEGATIVE_INFINITY;
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== LIGHT_ON_YOUR_FEET ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY) ||
      event.value < 5000 ||
      event.time - previous <= TRANSITION_WINDOW_MS
    ) {
      return [];
    }

    previous = event.time;
    const recordedEvade = actions.some((action) => {
      const skill = rangerSkill(
        context,
        action.canonicalSkillId ?? action.rawSkillId,
        action.canonicalName ?? action.rawName
      );
      return (
        skill?.evades === true &&
        event.time >= action.start - TRANSITION_WINDOW_MS &&
        event.time <= action.end + TRANSITION_WINDOW_MS
      );
    });
    return recordedEvade ? [] : [directAction(eventIndex, event.time, LIGHT_ON_YOUR_FEET, DODGE.name, DODGE, 'effect')];
  });
}

export function reconstructDruidActions(
  context: EvtcProfessionReconstructionContext,
  recordedActions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  let actions = [
    ...recordedActions,
    ...truncatedNaturalConvergence(context, recordedActions),
    ...avatarExitActions(context)
  ];
  actions = [...actions, ...initialVipersNest(context, actions)];
  actions = alignInitialAvatar(actions);
  actions = removeAvatarWeaponSwaps(actions);
  return [...actions, ...seedOfLifeActions(actions), ...dodgeActions(context, actions)];
}
