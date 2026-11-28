import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';
import { mergeCompositeActions } from '#gw2/integrations/logs/shared/rotation/rules/composites.js';

const COMPOSITE_SIGNAL_WINDOW_MS = 150;

/** Merge split animations before resolving external skill IDs. */
export function normalizeAmalgamLogActions(context: LogActionNormalizationContext): readonly RecordedLogAction[] {
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
