import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const POWER_SPIKE_ID = 10212;

/** Keeps represented Power Spike inputs independent without reconstructing missing casts. */
export function reconstructMesmerDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const actions = context.recordedActions.map((action) =>
    action.rawSkillId === POWER_SPIKE_ID ? { ...action, independentTimeline: true } : action
  );
  return actions;
}
