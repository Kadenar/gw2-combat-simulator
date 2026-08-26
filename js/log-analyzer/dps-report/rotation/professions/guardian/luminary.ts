import type { Skill } from '../../../../../platform/engine/types.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';

const EFFULGENT_DAMAGE_SIGNAL_ID = 76730;

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function actionSkill(action: DpsReportRecordedAction, context: DpsReportProfessionReconstructionContext): Skill | null {
  return (
    context.catalog?.skills.find(
      (skill) =>
        (typeof skill.id === 'number' && Number(skill.id) === action.rawSkillId) ||
        normalized(skill.name) === normalized(action.rawName)
    ) || null
  );
}

function physicalWeapon(skill: Skill | null): string | null {
  if (normalized(skill?.type) !== 'weapon') return null;
  const weapon = String(skill?.weapon || '').trim();
  return weapon ? normalized(weapon) : null;
}

function normalizeWeaponTransitions(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  return sorted.filter((action, index) => {
    if (!action.isSwap || normalized(action.rawName) !== 'weapon swap') return true;
    const previous = sorted
      .slice(0, index)
      .reverse()
      .map((candidate) => physicalWeapon(actionSkill(candidate, context)))
      .find(Boolean);
    const next = sorted
      .slice(index + 1)
      .map((candidate) => physicalWeapon(actionSkill(candidate, context)))
      .find(Boolean);
    return previous != null && next != null && previous !== next;
  });
}

function inferredAction(
  context: DpsReportProfessionReconstructionContext,
  anchor: DpsReportRecordedAction,
  name: string,
  eventOffset: number
): DpsReportRecordedAction | null {
  const skill = context.catalog?.skills.find((candidate) => normalized(candidate.name) === normalized(name));
  if (!skill || typeof skill.id !== 'number') return null;
  return {
    start: anchor.start,
    end: anchor.start,
    rawSkillId: Number(skill.id),
    rawName: skill.name,
    status: 'instant',
    eventIndex: anchor.eventIndex + eventOffset,
    isSwap: false,
    metadataAccurate: false,
    inference: 'luminary-opening',
    canonicalSkillId: Number(skill.id),
    canonicalName: skill.name
  };
}

/** Recovers Luminary's opening Forge state and rejects EI's internal transition/proc signals. */
export function reconstructLuminaryDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const withoutProc = context.recordedActions.filter(
    (action) =>
      action.rawSkillId !== EFFULGENT_DAMAGE_SIGNAL_ID && normalized(action.rawName) !== 'effulgent stance (damage)'
  );
  const actions = normalizeWeaponTransitions(context, withoutProc);
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const anchor = sorted[0];
  if (!anchor) return [];

  const firstForgeWeapon = sorted.find((action) => actionSkill(action, context)?.radiantForgeSkill === true);
  const firstEnter = sorted.find((action) => normalized(action.rawName) === 'enter radiant forge');
  const needsForge = firstForgeWeapon != null && (firstEnter == null || firstForgeWeapon.start < firstEnter.start);

  const firstCourage = sorted.find((action) => normalized(action.rawName) === 'radiant courage');
  const openingBlade = sorted.find((action) => normalized(action.rawName) === 'gleaming blade');
  const courageSkill = context.catalog?.skills.find((skill) => normalized(skill.name) === 'radiant courage');
  const courageWindowMs = Math.max(0, Number(courageSkill?.cooldown || 0) * 1000);
  const needsCourage =
    firstCourage != null &&
    openingBlade != null &&
    openingBlade.start < firstCourage.start &&
    firstCourage.start - anchor.start <= courageWindowMs;

  const inferred = [
    needsCourage ? inferredAction(context, anchor, 'Radiant Courage', -2) : null,
    needsForge ? inferredAction(context, anchor, 'Enter Radiant Forge', -1) : null
  ].filter((action): action is DpsReportRecordedAction => action != null);
  return [...inferred, ...sorted].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
