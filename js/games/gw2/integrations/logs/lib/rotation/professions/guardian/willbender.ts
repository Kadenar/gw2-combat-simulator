import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const RUSHING_JUSTICE_ID = 62668;
const RUSHING_JUSTICE_IMPACT_ID = 62624;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

function numericSkillId(action: RecordedLogAction): number {
  return Number(action.canonicalSkillId ?? action.rawSkillId);
}

/** Combines represented Willbender segments; a fireball does not establish a missing charge input. */
export function reconstructWillbenderDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const consumed = new Set<RecordedLogAction>();
  const normalized: RecordedLogAction[] = [];
  for (const action of sorted) {
    if (consumed.has(action)) continue;
    if (numericSkillId(action) !== RUSHING_JUSTICE_ID) {
      normalized.push(action);
      continue;
    }

    const impact = sorted.find(
      (candidate) =>
        !consumed.has(candidate) &&
        numericSkillId(candidate) === RUSHING_JUSTICE_IMPACT_ID &&
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
      expectedDurationMs: Math.max(Number(action.expectedDurationMs || 0), Number(impact.expectedDurationMs || 0)),
      status: impact.status,
      canonicalSkillId: RUSHING_JUSTICE_ID,
      canonicalName: 'Rushing Justice'
    });
  }

  return normalized.sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
