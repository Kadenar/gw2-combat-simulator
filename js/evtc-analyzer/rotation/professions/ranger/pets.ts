import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../../types.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';
import { directAction, firstPlayerEventTime, playerInstance, rangerSkill, rawSkillName } from './shared.js';

const SWAP_PETS = Object.freeze({ name: 'Swap Pets', skillId: -4 });
const AGENT_SPAWN_STATE_CHANGE = 6;

export function ownedPetAddresses(
  context: EvtcProfessionReconstructionContext,
  ownerInstance: number
): ReadonlySet<bigint> {
  const addresses = new Set<bigint>();
  const agentAddresses = new Set(
    context.log.agents.filter((agent) => agent.profession < 0xffff0000).map((agent) => agent.address)
  );
  for (const event of context.log.events) {
    if (
      event.source === context.playerAddress ||
      !agentAddresses.has(event.source) ||
      event.sourceMasterInstance !== ownerInstance
    ) {
      continue;
    }
    const skill = rangerSkill(context, event.skillId);
    if (skill?.petSkill === true || skill?.unleashedPetSkill === true) {
      addresses.add(event.source);
    }
  }
  return addresses;
}

function petCommandActions(
  context: EvtcProfessionReconstructionContext,
  ownerInstance: number,
  petAddresses: ReadonlySet<bigint>
): EvtcRecordedRotationAction[] {
  const actions: EvtcRecordedRotationAction[] = [];
  const starts = new Set<string>();
  const firstEventTime = firstPlayerEventTime(context);

  context.log.events.forEach((event, eventIndex) => {
    if (
      !petAddresses.has(event.source) ||
      event.sourceMasterInstance !== ownerInstance ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE &&
        event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_START &&
        event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP)
    ) {
      return;
    }
    const name = rawSkillName(context, event.skillId);
    const skill = rangerSkill(context, event.skillId, name);
    if (skill?.petSkill !== true || skill.petAutonomousSkill === true) return;
    const key = `${event.source}:${event.skillId}`;
    if (event.activation === EVTC_ACTIVATION.START || event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START) {
      starts.add(key);
      const stop = context.log.events
        .slice(eventIndex + 1)
        .find(
          (candidate) =>
            candidate.source === event.source &&
            candidate.skillId === event.skillId &&
            (candidate.stateChange === EVTC_STATE_CHANGE.NONE ||
              candidate.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP) &&
            (candidate.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
              candidate.activation === EVTC_ACTIVATION.CANCEL_CANCEL ||
              candidate.activation === EVTC_ACTIVATION.RESET)
        );
      actions.push({
        ...directAction(
          eventIndex,
          event.time,
          event.skillId,
          name,
          { name: skill.name, skillId: Number(skill.id) },
          'animation'
        ),
        end: stop?.time ?? event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: stop?.activation === EVTC_ACTIVATION.CANCEL_CANCEL ? 'interrupted' : 'completed'
      });
      return;
    }
    if (
      !starts.has(key) &&
      firstEventTime != null &&
      event.value > 0 &&
      (event.activation === EVTC_ACTIVATION.CANCEL_FIRE || event.activation === EVTC_ACTIVATION.RESET) &&
      (event.stateChange === EVTC_STATE_CHANGE.NONE || event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP)
    ) {
      const start = event.time - event.value;
      if (start >= firstEventTime) return;
      starts.add(key);
      actions.push({
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          name,
          { name: skill.name, skillId: Number(skill.id) },
          'initial-state'
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: 'completed',
        precast: true
      });
    }
  });
  return actions;
}

function petSwapActions(
  context: EvtcProfessionReconstructionContext,
  petAddresses: ReadonlySet<bigint>
): EvtcRecordedRotationAction[] {
  return context.log.events.flatMap((event, eventIndex) => {
    if (!petAddresses.has(event.source) || event.stateChange !== AGENT_SPAWN_STATE_CHANGE) {
      return [];
    }
    return [directAction(eventIndex, event.time, 0, SWAP_PETS.name, SWAP_PETS, 'state-change')];
  });
}

export function reconstructRangerPetActions(
  context: EvtcProfessionReconstructionContext
): EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const pets = ownedPetAddresses(context, ownerInstance);
  return [...petCommandActions(context, ownerInstance, pets), ...petSwapActions(context, pets)];
}
