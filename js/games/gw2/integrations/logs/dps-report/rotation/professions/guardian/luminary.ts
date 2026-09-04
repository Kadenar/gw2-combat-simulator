import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { createInferredAction } from '#gw2/integrations/logs/dps-report/rotation/create-inferred-action.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const EFFULGENT_DAMAGE_SIGNAL_ID = 76730;

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
      .map((candidate) => physicalWeapon(recordedActionSkill(candidate, context)))
      .find(Boolean);
    const next = sorted
      .slice(index + 1)
      .map((candidate) => physicalWeapon(recordedActionSkill(candidate, context)))
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
  return createInferredAction(skill, anchor.start, anchor.start, anchor.eventIndex + eventOffset, 'luminary-opening');
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

  const firstForgeWeapon = sorted.find((action) => recordedActionSkill(action, context)?.radiantForgeSkill === true);
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
