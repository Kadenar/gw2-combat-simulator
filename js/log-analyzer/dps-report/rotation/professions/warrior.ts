import { mergedActionStatus, mergeCompositeActions } from '../../../lib/rotation/rules/composites.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../types.js';

const REND_ANIMATION_ID = 80_247;
const REND_FOLLOW_UP_ANIMATION_ID = 80_224;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

/** Collapses Rend's two serial EI animation rows into the single player cast that produced them. */
export function reconstructWarriorDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  return mergeCompositeActions(
    context.recordedActions,
    [
      {
        startId: REND_ANIMATION_ID,
        finishId: REND_FOLLOW_UP_ANIMATION_ID,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS,
        dropUnmatchedFinish: true
      }
    ],
    (action, followUp) => ({
      ...action,
      end: Math.max(action.end, followUp.end),
      status: mergedActionStatus(action.status, followUp.status),
      metadataAccurate: action.metadataAccurate && followUp.metadataAccurate,
      expectedDurationMs:
        Number(action.expectedDurationMs || action.end - action.start) +
        Number(followUp.expectedDurationMs || followUp.end - followUp.start),
      canonicalSkillId: REND_ANIMATION_ID,
      canonicalName: 'Rend'
    })
  );
}
