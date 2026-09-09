import { normalizeConduitHazeActions } from '#gw2/integrations/logs/lib/rotation/rules/conduit.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';
const GENERATED_SIGNAL_IDS = new Set([76818, 77116]);

/** Combines represented Conduit animation segments and filters generated signals. */
export function reconstructConduitDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  return normalizeConduitHazeActions(
    context.recordedActions.filter((action) => !GENERATED_SIGNAL_IDS.has(action.rawSkillId)),
    context.catalog
  );
}
