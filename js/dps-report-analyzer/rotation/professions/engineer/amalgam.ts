import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';

const COMPOSITE_SIGNAL_WINDOW_MS = 150;

/** Merges EI's split Amalgam animations into the single player action that caused them. */
export function reconstructAmalgamDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const consumed = new Set<DpsReportRecordedAction>();
  const result: DpsReportRecordedAction[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const action = sorted[index];
    if (consumed.has(action)) continue;
    const followUpId = action.rawName === 'Offensive Protocol: Demolish' ? 77013 : 77307;
    const composite = action.rawName === 'Offensive Protocol: Demolish' || action.rawName === 'Plasmatic State';
    const followUp = composite
      ? sorted
          .slice(index + 1)
          .find(
            (candidate) =>
              candidate.rawName === action.rawName &&
              candidate.rawSkillId === followUpId &&
              candidate.start >= action.end &&
              candidate.start - action.end <= COMPOSITE_SIGNAL_WINDOW_MS
          )
      : undefined;
    if (!followUp) {
      result.push(action);
      continue;
    }

    result.push({
      ...action,
      end: Math.max(action.end, followUp.end),
      status: followUp.status,
      metadataAccurate: action.metadataAccurate && followUp.metadataAccurate
    });
    consumed.add(followUp);
  }

  return result;
}
