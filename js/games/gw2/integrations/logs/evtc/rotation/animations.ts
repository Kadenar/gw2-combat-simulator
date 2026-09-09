import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
  type ParsedEvtc,
  type ParsedEvtcEvent
} from '#gw2/integrations/logs/evtc/types.js';
import { evtcRecordingWindow } from '#gw2/integrations/logs/evtc/recording.js';
import type { EvtcRecordedRotationAction as RecordedAction } from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

const SERVER_DELAY_MS = 10;
const STANDARD_DODGE_ANIMATION_ID = 23275;
export const WEAPON_STOW_ANIMATION_ID = 23285;

/** Match .NET Math.Round's ties-to-even behavior for EI duration and acceleration metadata. */
function roundEven(value: number): number {
  const floor = Math.floor(value);
  return value - floor === 0.5 ? floor + (floor % 2 === 0 ? 0 : 1) : Math.round(value);
}

function skillName(names: ReadonlyMap<number, string>, id: number): string {
  if (id === STANDARD_DODGE_ANIMATION_ID) return 'Dodge';
  if (id === WEAPON_STOW_ANIMATION_ID) return 'Weapon Stow';
  return names.get(id)?.trim() || 'Unknown ' + id;
}

/** EI d7f186c AnimatedCastEvent: observed duration, activation and acceleration remain source evidence. */
function animatedCast(
  start: ParsedEvtcEvent | null,
  stop: ParsedEvtcEvent | null,
  eventIndex: number,
  names: ReadonlyMap<number, string>,
  logEnd: number,
  modern: boolean
): RecordedAction {
  const event = start ?? stop!;
  const at = start?.time ?? stop!.time - stop!.value;
  const dodge = event.skillId === STANDARD_DODGE_ANIMATION_ID;
  let expected = start ? (start.buffDamage > 0 ? start.buffDamage : start.value) : stop!.value;
  if (!stop && dodge) expected = 750;
  let duration = stop?.value ?? Math.min(expected, logEnd - at);
  let scaled = stop?.buffDamage ?? 0;
  if (start && stop && Math.abs(duration - (stop.time - start.time)) > SERVER_DELAY_MS) {
    duration = stop.time - start.time;
    scaled = 0;
  }

  if (stop && dodge) {
    expected = duration;
    scaled = 0;
  }

  const ratio = scaled > 0 && duration > 0 ? scaled / duration : 1;
  let acceleration = !modern && start?.activation === EVTC_ACTIVATION.QUICKNESS ? 1 : 0;
  let status: RecordedAction['status'] = 'unknown';
  let savedDuration = 0;
  if (stop) {
    if (scaled > 0) acceleration = Math.max(-1, Math.min(1, ratio > 1 ? (ratio - 1) / 0.5 : -(1 - ratio) / 0.6));
    // Resurrect remains unknown in EI regardless of the activation byte.
    if (event.skillId !== 1066) {
      if (stop.activation === EVTC_ACTIVATION.CANCEL_CANCEL) {
        status = 'interrupted';
        savedDuration = -duration;
      } else if (stop.activation === EVTC_ACTIVATION.RESET) status = 'completed';
      else if (stop.activation === EVTC_ACTIVATION.CANCEL_FIRE || stop.activation === 6) {
        status = 'reduced';
        savedDuration = Math.max(roundEven(expected / ratio) - duration, 0);
      }
    }
  }

  return {
    start: at,
    end: at + duration,
    expectedDuration: expected,
    rawSkillId: event.skillId,
    rawName: skillName(names, event.skillId),
    evidence: modern ? 'animation' : 'legacy-activation',
    status,
    eventIndex,
    acceleration: roundEven(acceleration * 1000) / 1000,
    savedDurationMs: savedDuration,
    ...(start ? {} : { precast: true })
  };
}

/** EI CombatEventFactory.CreateCastEvents pairs within actor/skill groups and truncates only unknown casts. */
function pairAnimations(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>,
  modern: boolean
): RecordedAction[] {
  const window = evtcRecordingWindow(log);
  const pending = new Map<number, { event: ParsedEvtcEvent; index: number }>();
  const actions: RecordedAction[] = [];
  for (const [index, event] of log.events.entries()) {
    if (event.source !== address) continue;
    const isStart = modern
      ? event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START
      : event.stateChange === 0 && [1, 2].includes(event.activation);
    const isStop = modern
      ? event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP
      : event.stateChange === 0 && [3, 4, 5, 6].includes(event.activation);
    if (!isStart && !isStop) continue;
    const start = pending.get(event.skillId);
    if (isStart) {
      if (start) actions.push(animatedCast(start.event, null, start.index, names, window.end, modern));
      pending.set(event.skillId, { event, index });
    } else {
      const action = animatedCast(start?.event ?? null, event, start?.index ?? index, names, window.end, modern);
      if (start || action.start < window.start) actions.push(action);
      pending.delete(event.skillId);
    }
  }

  for (const { event, index } of pending.values())
    actions.push(animatedCast(event, null, index, names, window.end, modern));
  const player = log.agents.some((agent) => agent.address === address && agent.elite !== 0xffffffff);
  const sorted = actions
    .filter((action) => !player || action.end - action.start > 1)
    .sort((a, b) => a.start - b.start || a.eventIndex - b.eventIndex);
  return sorted.map((action, index) =>
    action.status === 'unknown' && sorted[index + 1]
      ? { ...action, end: Math.min(action.end, sorted[index + 1].start + SERVER_DELAY_MS) }
      : action
  );
}

/** Decodes modern animation records without requiring a surviving start. */
export function modernAnimationActions(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>
): RecordedAction[] {
  return pairAnimations(log, address, names, true);
}

/** Decodes legacy activations with the same pairing and recording-window contract. */
export function legacyActivationActions(
  log: ParsedEvtc,
  address: bigint,
  names: ReadonlyMap<number, string>
): RecordedAction[] {
  return pairAnimations(log, address, names, false);
}
