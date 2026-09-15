import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const POWER_SPIKE_ID = 10212;

/** Replays cloak-granting inputs once so their observed cloak gains do not spend dodge endurance. */
export function reconstructMesmerDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  return context.recordedActions.flatMap((action) => {
    if (action.rawSkillId === POWER_SPIKE_ID) return [{ ...action, independentTimeline: true }];
    if (context.profile.specializationId !== 'mirage' || action.rawSkillId !== -17) return [action];
    // Preserve sources identified from the raw adapter's buff, damage and effect evidence.
    if (action.canonicalSkillId != null && action.canonicalSkillId !== -17) {
      return context.recordedActions.some(
        (other) =>
          other !== action && other.rawSkillId === action.canonicalSkillId && Math.abs(other.start - action.start) < 10
      )
        ? []
        : [action];
    }

    const source = context.recordedActions.some(
      (other) =>
        [10190, 10191, 49068, -63, 10192, 10287, 43064, 45046].includes(other.rawSkillId) &&
        Math.abs(other.start - action.start) < 10
    );
    return source ? [] : [action];
  });
}
