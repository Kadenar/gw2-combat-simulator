/** Pairs modern animations and legacy activations into recorded EVTC casts before replay inference. */
import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
  type EvtcRotationEvidence,
  type ParsedEvtc,
  type ParsedEvtcEvent
} from '#gw2/integrations/logs/evtc/types.js';
import { EFFECT_PACKET_TOLERANCE_MS } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import type { EvtcRotationProfessionProfile } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import type { EvtcRecordedRotationAction as RecordedAction } from '#gw2/integrations/logs/evtc/rotation/professions/index.js';
import type { RotationActionStatus } from '#gw2/integrations/logs/lib/rotation/model.js';
import { selectedPlayerEvent } from '#gw2/integrations/logs/evtc/rotation/players.js';

const STANDARD_DODGE_ANIMATION_ID = 23275;
const STANDARD_DODGE_STOP_ACTIVATION = 6;
export const WEAPON_STOW_ANIMATION_ID = 23285;

function skillName(names: ReadonlyMap<number, string>, skillId: number): string {
  // arcdps emits ordinary dodge rolls through an unnamed animation ID; naming it here lets every profession resolve it to its simulator Dodge action.
  if (skillId === STANDARD_DODGE_ANIMATION_ID) return 'Dodge';
  if (skillId === WEAPON_STOW_ANIMATION_ID) return 'Weapon Stow';
  return names.get(skillId)?.trim() || `Unknown ${skillId}`;
}

function expectedDuration(event: ParsedEvtcEvent): number | null {
  const duration = event.buffDamage > 0 ? event.buffDamage : event.value;
  return duration >= 0 ? duration : null;
}

function activationStatus(activation: number): RotationActionStatus {
  if (activation === EVTC_ACTIVATION.CANCEL_CANCEL) return 'interrupted';
  if (activation === EVTC_ACTIVATION.CANCEL_FIRE) return 'completed';
  if (activation === EVTC_ACTIVATION.RESET) return 'completed';
  return 'unknown';
}

function isStandardDodgeStop(event: ParsedEvtcEvent): boolean {
  return event.skillId === STANDARD_DODGE_ANIMATION_ID && event.activation === STANDARD_DODGE_STOP_ACTIVATION;
}

function isWeaponStowStop(event: ParsedEvtcEvent): boolean {
  return event.skillId === WEAPON_STOW_ANIMATION_ID && event.activation === STANDARD_DODGE_STOP_ACTIVATION;
}

function pairAnimationEvents(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>,
  startStateChange: number,
  endStateChange: number,
  evidence: EvtcRotationEvidence,
  inferTruncatedPrecast = false
): RecordedAction[] {
  const firstPlayerEventTime = Math.min(
    ...log.events.filter((event) => selectedPlayerEvent(event, address) && event.time > 0).map((event) => event.time)
  );
  const combatStartTime = log.events.find(
    (event) => selectedPlayerEvent(event, address) && event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT
  )?.time;
  const starts: Array<{
    readonly event: ParsedEvtcEvent;
    readonly eventIndex: number;
    matched: boolean;
  }> = [];
  const ends: Array<{
    readonly event: ParsedEvtcEvent;
    readonly eventIndex: number;
  }> = [];
  log.events.forEach((event, eventIndex) => {
    if (!selectedPlayerEvent(event, address)) return;
    if (event.stateChange === startStateChange) {
      starts.push({ event, eventIndex, matched: false });
    } else if (
      event.stateChange === endStateChange &&
      (event.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
        event.activation === EVTC_ACTIVATION.CANCEL_CANCEL ||
        event.activation === EVTC_ACTIVATION.RESET ||
        isStandardDodgeStop(event) ||
        isWeaponStowStop(event))
    ) {
      ends.push({ event, eventIndex });
    }
  });

  const actions: RecordedAction[] = [];
  for (const end of ends) {
    const eligible = starts.filter(
      (start) =>
        !start.matched &&
        (start.event.time < end.event.time ||
          (start.event.time === end.event.time && start.eventIndex < end.eventIndex))
    );
    const exact = eligible.filter((start) => start.event.skillId === end.event.skillId);
    const start = (exact.length ? exact : eligible).at(-1);
    if (!start) {
      const rawName = skillName(names, end.event.skillId);
      const inferredStart = end.event.time - end.event.value;
      const truncatedAtLogStart =
        inferTruncatedPrecast && Number.isFinite(firstPlayerEventTime) && inferredStart < firstPlayerEventTime;
      // Modern arcdps can omit an animation start that happened just before combat while still recording its stop.
      const crossesCombatStart =
        combatStartTime != null && inferredStart <= combatStartTime && end.event.time >= combatStartTime;
      const hasCommitEvidence = log.events.some(
        (event) =>
          event.source === address &&
          event.skillId === end.event.skillId &&
          event.time >= inferredStart &&
          event.time <= end.event.time + EFFECT_PACKET_TOLERANCE_MS &&
          event.stateChange === 0 &&
          event.buffRemove === 0 &&
          (event.value > 0 || event.buffDamage > 0)
      );
      const precast = truncatedAtLogStart || (crossesCombatStart && hasCommitEvidence);
      if (end.event.value <= 0 || (!rawName.toLowerCase().includes('dodge') && !precast)) {
        continue;
      }

      actions.push({
        start: inferredStart,
        end: end.event.time,
        expectedDuration: expectedDuration(end.event),
        rawSkillId: end.event.skillId,
        rawName,
        evidence,
        status:
          isStandardDodgeStop(end.event) || isWeaponStowStop(end.event)
            ? 'completed'
            : activationStatus(end.event.activation),
        eventIndex: end.eventIndex,
        precast
      });
      continue;
    }

    start.matched = true;
    const elapsed = Math.max(0, end.event.time - start.event.time);
    const reported = Math.max(0, end.event.value);
    const duration = reported > 0 && Math.abs(reported - elapsed) <= 150 ? reported : elapsed;
    actions.push({
      start: start.event.time,
      end: start.event.time + duration,
      expectedDuration: expectedDuration(start.event),
      rawSkillId: start.event.skillId,
      rawName: skillName(names, start.event.skillId),
      evidence,
      status:
        isStandardDodgeStop(end.event) || isWeaponStowStop(end.event)
          ? 'completed'
          : activationStatus(end.event.activation),
      eventIndex: start.eventIndex
    });
  }

  for (const start of starts) {
    if (start.matched) continue;
    const duration = Math.max(0, expectedDuration(start.event) || 0);
    const rawName = skillName(names, start.event.skillId);
    if (duration === 0 && rawName.startsWith('Unknown ')) continue;
    actions.push({
      start: start.event.time,
      end: start.event.time + duration,
      expectedDuration: duration || null,
      rawSkillId: start.event.skillId,
      rawName,
      evidence,
      status: 'unknown',
      eventIndex: start.eventIndex
    });
  }

  return actions;
}

/** Uses modern start/stop records and transformation evidence to recover clipped precasts. */
export function modernAnimationActions(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>,
  profile: EvtcRotationProfessionProfile
): RecordedAction[] {
  const startsInConfiguredTransformation = log.events.some(
    (event) =>
      event.target === address &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL &&
      profile.buffTransitions.some((transition) => transition.gain != null && transition.buffSkillId === event.skillId)
  );
  return pairAnimationEvents(
    log,
    address,
    names,
    EVTC_STATE_CHANGE.ANIMATION_START,
    EVTC_STATE_CHANGE.ANIMATION_STOP,
    'animation',
    startsInConfiguredTransformation
  );
}

/** Normalizes both legacy encodings into the same paired-action representation. */
export function legacyActivationActions(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>
): RecordedAction[] {
  const starts = log.events.some(
    (event) =>
      selectedPlayerEvent(event, address) &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS)
  );
  if (starts) {
    const synthetic: ParsedEvtc = {
      ...log,
      events: log.events.map((event) => {
        if (event.stateChange !== EVTC_STATE_CHANGE.NONE) return event;
        if (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS) {
          return { ...event, stateChange: -1 };
        }

        if (
          event.activation === EVTC_ACTIVATION.CANCEL_FIRE ||
          event.activation === EVTC_ACTIVATION.CANCEL_CANCEL ||
          event.activation === EVTC_ACTIVATION.RESET
        ) {
          return { ...event, stateChange: -2 };
        }

        return event;
      })
    };
    return pairAnimationEvents(synthetic, address, names, -1, -2, 'legacy-activation');
  }

  return log.events.flatMap((event, eventIndex) => {
    if (
      !selectedPlayerEvent(event, address) ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.value <= 0 ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET)
    ) {
      return [];
    }

    return [
      {
        start: event.time,
        end: event.time + event.value,
        expectedDuration: event.value,
        rawSkillId: event.skillId,
        rawName: skillName(names, event.skillId),
        evidence: 'legacy-activation' as const,
        status: activationStatus(event.activation),
        eventIndex
      }
    ];
  });
}
