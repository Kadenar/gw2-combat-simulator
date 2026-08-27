import type { RotationActionStatus } from '../model.js';

export interface CompositeAction {
  readonly start: number;
  readonly end: number;
  readonly eventIndex: number;
  readonly rawSkillId: number;
  readonly rawName?: string;
  readonly status: RotationActionStatus;
}

export interface CompositeActionRule {
  readonly startId?: number;
  readonly startName?: string;
  readonly finishId: number;
  readonly finishName?: string;
  readonly maximumGapMs: number;
  readonly finishStartsAfterStartEnd?: boolean;
  readonly dropUnmatchedFinish?: boolean;
}

export function mergedActionStatus(first: RotationActionStatus, second: RotationActionStatus): RotationActionStatus {
  if (first === 'interrupted' || second === 'interrupted') return 'interrupted';
  if (first === 'reduced' || second === 'reduced') return 'reduced';
  if (first === 'unknown' || second === 'unknown') return 'unknown';
  if (first === 'instant' && second === 'instant') return 'instant';
  return 'completed';
}

/** Collapses source rows that describe one player input while allowing each adapter to retain its own metadata. */
export function mergeCompositeActions<Action extends CompositeAction>(
  actions: readonly Action[],
  rules: readonly CompositeActionRule[],
  merge: (start: Action, finish: Action) => Action
): Action[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const consumed = new Set<Action>();
  const result: Action[] = [];
  for (const action of sorted) {
    if (consumed.has(action)) continue;
    const rule = rules.find(
      (candidate) =>
        (candidate.startId == null || candidate.startId === action.rawSkillId) &&
        (candidate.startName == null || candidate.startName === action.rawName)
    );
    if (!rule) {
      const orphanedFinish = rules.some(
        (candidate) =>
          candidate.dropUnmatchedFinish === true &&
          candidate.finishId === action.rawSkillId &&
          (candidate.finishName == null || candidate.finishName === action.rawName)
      );
      if (orphanedFinish) continue;
      result.push(action);
      continue;
    }

    const finish = sorted.find(
      (candidate) =>
        !consumed.has(candidate) &&
        candidate !== action &&
        candidate.rawSkillId === rule.finishId &&
        (rule.finishName == null || candidate.rawName === rule.finishName) &&
        candidate.start >= (rule.finishStartsAfterStartEnd ? action.end : action.start) &&
        Math.abs(candidate.start - action.end) <= rule.maximumGapMs
    );
    if (!finish) {
      result.push(action);
      continue;
    }

    consumed.add(finish);
    result.push(merge(action, finish));
  }

  return result;
}
