import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const RUSHING_JUSTICE_ID = 62668;
const RUSHING_JUSTICE_IMPACT_ID = 62624;
const EXECUTIONERS_CALLING_ID = 62525;
const EXECUTIONERS_CALLING_DUAL_STRIKE_ID = 62656;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

function numericSkillId(action: RecordedLogAction): number {
  return Number(action.canonicalSkillId ?? action.rawSkillId);
}

/** Combines represented virtue and sword segments so one activation consumes only one cooldown. */
export function reconstructGuardianCompositeActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const consumed = new Set<RecordedLogAction>();
  const normalized: RecordedLogAction[] = [];
  for (const action of sorted) {
    if (consumed.has(action)) continue;
    const skillId = numericSkillId(action);
    const followupId =
      skillId === RUSHING_JUSTICE_ID
        ? RUSHING_JUSTICE_IMPACT_ID
        : skillId === EXECUTIONERS_CALLING_ID
          ? EXECUTIONERS_CALLING_DUAL_STRIKE_ID
          : null;
    if (followupId == null) {
      normalized.push(action);
      continue;
    }

    const impact = sorted.find(
      (candidate) =>
        !consumed.has(candidate) &&
        numericSkillId(candidate) === followupId &&
        candidate.start >= action.start &&
        candidate.start - action.end <= COMPOSITE_SIGNAL_WINDOW_MS
    );
    if (!impact) {
      normalized.push(action);
      continue;
    }

    consumed.add(impact);
    normalized.push({
      ...action,
      end: Math.max(action.end, impact.end),
      expectedDurationMs:
        skillId === EXECUTIONERS_CALLING_ID
          ? Number(action.expectedDurationMs || action.end - action.start) +
            Number(impact.expectedDurationMs || impact.end - impact.start)
          : Math.max(Number(action.expectedDurationMs || 0), Number(impact.expectedDurationMs || 0)),
      status: impact.status,
      canonicalSkillId: skillId,
      canonicalName: skillId === RUSHING_JUSTICE_ID ? 'Rushing Justice' : "Executioner's Calling"
    });
  }

  return normalized.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
