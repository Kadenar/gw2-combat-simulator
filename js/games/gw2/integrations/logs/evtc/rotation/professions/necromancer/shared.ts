import { EVTC_STATE_CHANGE, type ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export const INSTANT_SIGNAL_WINDOW_MS = 150;

/** Counts player-owned stacks captured in the EVTC initial buff snapshot. */
export function initialSelfBuffCount(log: ParsedEvtc, playerAddress: bigint, skillId: number): number {
  return log.events.filter(
    (event) =>
      event.source === playerAddress &&
      event.target === playerAddress &&
      event.skillId === skillId &&
      event.buff !== 0 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
  ).length;
}

export function effectAction(
  eventIndex: number,
  time: number,
  rawSkillId: number,
  rawName: string,
  canonical?: { readonly name: string; readonly skillId: number },
  evidence: EvtcRecordedRotationAction['evidence'] = 'effect'
): EvtcRecordedRotationAction {
  return {
    start: time,
    end: time,
    expectedDuration: 0,
    rawSkillId,
    rawName,
    evidence,
    status: 'instant',
    eventIndex,
    ...(canonical
      ? {
          canonicalSkillId: canonical.skillId,
          canonicalName: canonical.name
        }
      : {})
  };
}

export function hasRecordedAction(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  name: string,
  time: number,
  windowMs: number
): boolean {
  const normalizedName = name.toLowerCase();
  return context.recordedActions.some(
    (action) =>
      (action.rawSkillId === skillId || action.rawName.trim().toLowerCase() === normalizedName) &&
      Math.abs(action.start - time) <= windowMs
  );
}
