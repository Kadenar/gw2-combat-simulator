import type { EvtcRotationActionStatus } from '../../../evtc-analyzer/types.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../types.js';

const REND_ANIMATION_ID = 80_247;
const REND_FOLLOW_UP_ANIMATION_ID = 80_224;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

function mergedStatus(first: DpsReportRecordedAction, second: DpsReportRecordedAction): EvtcRotationActionStatus {
  if (first.status === 'interrupted' || second.status === 'interrupted') return 'interrupted';
  if (first.status === 'reduced' || second.status === 'reduced') return 'reduced';
  if (first.status === 'unknown' || second.status === 'unknown') return 'unknown';
  return 'completed';
}

/** Collapses Rend's two serial EI animation rows into the single player cast that produced them. */
export function reconstructWarriorDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const actions = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const consumed = new Set<DpsReportRecordedAction>();
  const result: DpsReportRecordedAction[] = [];

  for (const action of actions) {
    if (consumed.has(action) || action.rawSkillId === REND_FOLLOW_UP_ANIMATION_ID) continue;
    if (action.rawSkillId !== REND_ANIMATION_ID) {
      result.push(action);
      continue;
    }

    const followUp = actions.find(
      (candidate) =>
        !consumed.has(candidate) &&
        candidate.rawSkillId === REND_FOLLOW_UP_ANIMATION_ID &&
        candidate.start >= action.start &&
        Math.abs(candidate.start - action.end) <= COMPOSITE_SIGNAL_WINDOW_MS
    );
    if (!followUp) {
      result.push(action);
      continue;
    }

    consumed.add(followUp);
    result.push({
      ...action,
      end: Math.max(action.end, followUp.end),
      status: mergedStatus(action, followUp),
      metadataAccurate: action.metadataAccurate && followUp.metadataAccurate,
      expectedDurationMs:
        Number(action.expectedDurationMs || action.end - action.start) +
        Number(followUp.expectedDurationMs || followUp.end - followUp.start),
      canonicalSkillId: REND_ANIMATION_ID,
      canonicalName: 'Rend'
    });
  }

  return result;
}
