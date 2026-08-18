import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from '../types.js';

export const INSTANT_SIGNAL_WINDOW_MS = 150;

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
