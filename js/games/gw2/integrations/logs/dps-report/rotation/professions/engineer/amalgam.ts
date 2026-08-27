import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';
import { mergeCompositeActions } from '../../../../lib/rotation/rules/composites.js';

const COMPOSITE_SIGNAL_WINDOW_MS = 150;

/** Merges EI's split Amalgam animations into the single player action that caused them. */
export function reconstructAmalgamDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  return mergeCompositeActions(
    context.recordedActions,
    [
      {
        startName: 'Offensive Protocol: Demolish',
        finishName: 'Offensive Protocol: Demolish',
        finishId: 77013,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS,
        finishStartsAfterStartEnd: true
      },
      {
        startName: 'Plasmatic State',
        finishName: 'Plasmatic State',
        finishId: 77307,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS,
        finishStartsAfterStartEnd: true
      }
    ],
    (action, followUp) => ({
      ...action,
      end: Math.max(action.end, followUp.end),
      status: followUp.status,
      metadataAccurate: action.metadataAccurate && followUp.metadataAccurate
    })
  );
}
