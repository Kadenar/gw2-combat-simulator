import type { Skill } from '../../../../../platform/engine/types.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function namedSkill(context: DpsReportProfessionReconstructionContext, name: string): Skill | null {
  return context.catalog?.skills.find((skill) => normalized(skill.name) === normalized(name)) || null;
}

function inferredAction(
  context: DpsReportProfessionReconstructionContext,
  anchor: DpsReportRecordedAction,
  name: string,
  start: number,
  end: number,
  eventOffset: number
): DpsReportRecordedAction | null {
  const skill = namedSkill(context, name);

  if (!skill || typeof skill.id !== 'number') return null;
  return {
    start,
    end,
    rawSkillId: Number(skill.id),
    rawName: skill.name,
    status: end > start ? 'completed' : 'instant',
    eventIndex: anchor.eventIndex + eventOffset,
    isSwap: false,
    metadataAccurate: false,
    inference: 'herald-opening',
    canonicalSkillId: Number(skill.id),
    canonicalName: skill.name
  };
}

function hasOpeningDependency(
  actions: readonly DpsReportRecordedAction[],
  firstDemonSwap: DpsReportRecordedAction | undefined,
  facetName: string,
  consumeName: string
): boolean {
  const opening = firstDemonSwap ? actions.filter((action) => action.start < firstDemonSwap.start) : actions;
  const consume = opening.find((action) => normalized(action.rawName) === normalized(consumeName));

  if (!consume) return false;
  return !opening.some(
    (action) => normalized(action.rawName) === normalized(facetName) && action.start <= consume.start
  );
}

function provesOpeningSpiritcrush(
  actions: readonly DpsReportRecordedAction[],
  anchor: DpsReportRecordedAction
): boolean {
  if (normalized(anchor.rawName) !== 'sevenshot') return false;
  return actions.some((action, index) => {
    if (normalized(action.rawName) !== 'spiritcrush' || action.start <= anchor.start) return false;
    const shotIndex = actions.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        candidate.start >= action.end &&
        candidate.start - action.end <= 2_000 &&
        normalized(candidate.rawName) === 'sevenshot'
    );

    if (shotIndex < 0) return false;
    return !actions
      .slice(index + 1, shotIndex)
      .some(
        (candidate) =>
          candidate.isSwap ||
          normalized(candidate.canonicalName) === 'swap legends' ||
          normalized(candidate.rawName).startsWith('legendary ')
      );
  });
}

/** Recovers Herald precasts only when opening consumes and a later Shortbow cycle prove them. */
export function reconstructHeraldDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const anchor = sorted[0];

  if (!anchor) return [];

  const firstDemonSwap = sorted.find((action) => normalized(action.rawName) === 'legendary demon stance');
  const needsElements = hasOpeningDependency(sorted, firstDemonSwap, 'Facet of Elements', 'Elemental Blast');
  const needsStrength = hasOpeningDependency(sorted, firstDemonSwap, 'Facet of Strength', 'Burst of Strength');
  const needsSpiritcrush = provesOpeningSpiritcrush(sorted, anchor);
  const spiritcrush = namedSkill(context, 'Spiritcrush');
  const spiritcrushDuration = Math.max(0, Number(spiritcrush?.quicknessCastTimeMs || spiritcrush?.castTimeMs || 0));
  const spiritcrushStart = needsSpiritcrush ? anchor.start - spiritcrushDuration : anchor.start;
  const inferred = [
    needsElements ? inferredAction(context, anchor, 'Facet of Elements', spiritcrushStart, spiritcrushStart, -3) : null,
    needsStrength ? inferredAction(context, anchor, 'Facet of Strength', spiritcrushStart, spiritcrushStart, -2) : null,
    needsSpiritcrush ? inferredAction(context, anchor, 'Spiritcrush', spiritcrushStart, anchor.start, -1) : null
  ].filter((action): action is DpsReportRecordedAction => action != null);

  return [...inferred, ...sorted].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
