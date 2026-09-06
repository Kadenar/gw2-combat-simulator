import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { effectWindowMs, findRotationSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import {
  inferDetonateActions,
  kitIdentity,
  normalizeKitTransitions,
  openingDamageSkillNames,
  PRECOMBAT_BOMBS
} from '#gw2/integrations/logs/evtc/rotation/professions/engineer/kits.js';
import {
  canonicalAction,
  castDuration,
  type EngineerActionIdentity,
  findOpeningPrecast,
  selectedSkill
} from '#gw2/integrations/logs/evtc/rotation/professions/engineer/shared.js';
import { playerInstance } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';

const COMMANDS: ReadonlyMap<number, EngineerActionIdentity> = new Map([
  [63121, { name: 'Jade Mortar', skillId: 63121 }],
  [63141, { name: 'Barrier Burst', skillId: 63141 }],
  [63188, { name: 'Spark Revolver', skillId: 63188 }],
  [63236, { name: 'Sky Circus', skillId: 63236 }],
  [63293, { name: 'Crisis Zone', skillId: 63293 }],
  [63334, { name: 'Rolling Smash', skillId: 63334 }],
  [63345, { name: 'Core Reactor Shot', skillId: 63345 }],
  [63365, { name: 'Explosive Knuckle', skillId: 63365 }],
  [63367, { name: 'Discharge Array', skillId: 63367 }]
]);
const OVERCLOCK_BUFF_ID = 63059;
const OVERCLOCK_SIGNET = Object.freeze({
  name: 'Overclock Signet',
  skillId: 63095
});
const OPENING_WEAPONS: ReadonlyMap<string, EngineerActionIdentity> = new Map([
  ['Glue Shot', { name: 'Glue Shot', skillId: 5830 }],
  ['Net Shot', { name: 'Net Shot', skillId: 6004 }]
]);

function mechCommandActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  const instance = playerInstance(context);
  if (instance == null) return [];
  const outstanding = new Map<string, number>();
  const actions: EvtcRecordedRotationAction[] = [];
  const discharge = findRotationSkill(63367, 'Discharge Array', context.catalog, context.profile);
  const dischargeWindow = discharge ? effectWindowMs(discharge) : 4100;
  let previousDischarge = Number.NEGATIVE_INFINITY;
  const combatStart = context.log.events.find(
    (event) => event.source === context.playerAddress && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  )?.time;

  context.log.events.forEach((event, eventIndex) => {
    const identity = COMMANDS.get(event.skillId);
    if (!identity || event.sourceMasterInstance !== instance || event.source === context.playerAddress) {
      return;
    }

    const key = `${event.source}:${event.skillId}`;
    // Modern mech animations carry the cast boundary in stateChange; legacy logs use activation.
    if (
      event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
      (event.stateChange === EVTC_STATE_CHANGE.NONE &&
        (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS))
    ) {
      outstanding.set(key, (outstanding.get(key) || 0) + 1);
      if (event.skillId === 63367) previousDischarge = event.time;
      actions.push(canonicalAction(eventIndex, event.time, identity, event.skillId, 'resource-inference'));
      return;
    }

    // Discharge Array has no cast animation: its five pulses identify one command, even across multiple targets.
    if (
      event.skillId === 63367 &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === EVTC_ACTIVATION.NONE &&
      event.buff === 0 &&
      event.buffRemove === 0 &&
      event.value > 0 &&
      event.time - previousDischarge >= dischargeWindow
    ) {
      previousDischarge = event.time;
      actions.push(canonicalAction(eventIndex, event.time, identity, event.skillId, 'effect'));
      return;
    }

    if (
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP) ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET)
    ) {
      return;
    }

    const pending = outstanding.get(key) || 0;
    if (pending > 0) {
      outstanding.set(key, pending - 1);
      return;
    }

    const inferredStart = event.time - Math.max(0, event.value);
    if (event.value > 0 && combatStart != null && inferredStart < combatStart && event.time <= combatStart + 1200) {
      actions.push(canonicalAction(eventIndex, inferredStart, identity, event.skillId, 'resource-inference'));
    }
  });
  return actions;
}

function overclockActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  let previous = Number.NEGATIVE_INFINITY;
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== OVERCLOCK_BUFF_ID ||
      event.buff === 0 ||
      event.buffRemove === 0 ||
      // Accept both buff-removal encodings; paired single/all removals still represent one signet use.
      (event.stateChange !== EVTC_STATE_CHANGE.NONE &&
        event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_SINGLE &&
        event.stateChange !== EVTC_STATE_CHANGE.BUFF_REMOVE_ALL) ||
      event.time - previous < 50
    ) {
      return [];
    }

    previous = event.time;
    return [canonicalAction(eventIndex, event.time, OVERCLOCK_SIGNET, event.skillId, 'resource-inference')];
  });
}

function openingActions(
  context: EvtcProfessionReconstructionContext,
  commands: EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const opening = findOpeningPrecast(context, OPENING_WEAPONS);
  if (!opening) return [];
  const openingCore = commands.find(
    (action) => action.rawName === 'Core Reactor Shot' && action.start === opening.start
  );
  if (openingCore) {
    const index = commands.indexOf(openingCore);
    commands[index] = { ...openingCore, eventIndex: opening.eventIndex - 1 };
  }

  const initialNames = openingDamageSkillNames(context, 3500);
  const bombs = selectedSkill(context, 'Bomb Kit')
    ? PRECOMBAT_BOMBS.filter((identity) => initialNames.has(identity.name))
    : [];
  if (!bombs.length) return [opening];

  let cursor = opening.start;
  const scheduled: EvtcRecordedRotationAction[] = [];
  for (let index = bombs.length - 1; index >= 0; index -= 1) {
    const identity = bombs[index];
    const duration = castDuration(context, identity);
    cursor -= duration;
    scheduled.unshift({
      ...canonicalAction(opening.eventIndex - 100 - index, cursor, identity, identity.skillId, 'initial-state'),
      end: cursor + duration,
      expectedDuration: duration,
      status: 'completed',
      precast: true
    });
  }

  const equip = kitIdentity(context, 'Bomb Kit', false);
  const stow = kitIdentity(context, 'Bomb Kit', true);
  if (equip) {
    scheduled.unshift(canonicalAction(opening.eventIndex - 300, cursor, equip, equip.skillId, 'initial-state'));
  }

  if (stow) {
    scheduled.push(canonicalAction(opening.eventIndex - 2, opening.start, stow, stow.skillId, 'initial-state'));
  }

  scheduled.push(opening);
  return scheduled;
}

export function reconstructMechanistActions(
  context: EvtcProfessionReconstructionContext
): EvtcRecordedRotationAction[] {
  const commands = mechCommandActions(context);
  const opening = openingActions(context, commands);
  const actions = normalizeKitTransitions(context, context.recordedActions);
  actions.push(...commands);
  actions.push(...overclockActions(context));
  actions.push(...inferDetonateActions(context));
  actions.push(...opening);
  return actions;
}
