import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/lib/rotation/rules/composites.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const REND_ANIMATION_ID = 80_247;
const REND_FOLLOW_UP_ANIMATION_ID = 80_224;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

/** Collapses Rush and Rend's serial EI animation rows into the single player cast that produced them. */
export function reconstructWarriorDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  return mergeCompositeActions(
    context.recordedActions,
    [
      {
        startId: REND_ANIMATION_ID,
        finishId: REND_FOLLOW_UP_ANIMATION_ID,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS
      },
      { startId: 14446, finishId: 14493, maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS }
    ],
    (action, followUp) => ({
      ...action,
      end: Math.max(action.end, followUp.end),
      status: mergedActionStatus(action.status, followUp.status),
      metadataAccurate: action.metadataAccurate && followUp.metadataAccurate,
      expectedDurationMs:
        Number(action.expectedDurationMs || action.end - action.start) +
        Number(followUp.expectedDurationMs || followUp.end - followUp.start),
      canonicalSkillId: action.rawSkillId,
      canonicalName: action.rawSkillId === REND_ANIMATION_ID ? 'Rend' : 'Rush'
    })
  );
}
