import type { Skill } from '../../../platform/engine/types.js';
import { reconstructLuminaryDpsReportActions } from './guardian/luminary.js';
import { reconstructWillbenderDpsReportActions } from './guardian/willbender.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '../types.js';

const specializationReconstructors: ReadonlyMap<string, DpsReportProfessionActionReconstructor> = new Map([
  ['luminary', reconstructLuminaryDpsReportActions],
  ['willbender', reconstructWillbenderDpsReportActions]
]);

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function actionSkill(action: DpsReportRecordedAction, context: DpsReportProfessionReconstructionContext): Skill | null {
  const id = action.canonicalSkillId ?? action.rawSkillId;
  const name = action.canonicalName ?? action.rawName;
  return (
    context.catalog?.skills.find(
      (skill) =>
        (typeof skill.id === 'number' && Number(skill.id) === Number(id)) || normalized(skill.name) === normalized(name)
    ) || null
  );
}

function normalizeGuardianAutoattacks(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  let activeChainRoot: number | null = null;
  let expectedSkillId: number | null = null;
  const result: DpsReportRecordedAction[] = [];

  for (const action of sorted) {
    const skill = actionSkill(action, context);
    const autoattack = normalized(skill?.slot) === 'weapon_1';
    if (autoattack && action.status === 'interrupted') continue;
    const chainRoot = Number(skill?.chainRoot);
    if (autoattack && Number.isFinite(chainRoot)) {
      const canonicalId: number =
        activeChainRoot === chainRoot && expectedSkillId != null ? expectedSkillId : chainRoot;
      const canonical: Skill | undefined = context.catalog?.skills.find(
        (candidate) => typeof candidate.id === 'number' && Number(candidate.id) === canonicalId
      );
      result.push({
        ...action,
        canonicalSkillId: canonicalId,
        canonicalName: canonical?.name || action.canonicalName || action.rawName
      });
      activeChainRoot = chainRoot;
      const next: number | null = canonical?.nextChainId == null ? null : Number(canonical.nextChainId);
      expectedSkillId = next != null && Number.isFinite(next) ? next : chainRoot;
      continue;
    }

    if (
      action.isSwap ||
      Number(skill?.castTimeMs || skill?.quicknessCastTimeMs || 0) > 0 ||
      skill?.handlerId === 'guardian.radiant-forge'
    ) {
      activeChainRoot = null;
      expectedSkillId = null;
    }

    result.push(action);
  }

  return result;
}

/** Applies Guardian specialization recovery and removes uncommitted autoattack animations. */
export function reconstructGuardianDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const specialized = specializationReconstructors.get(context.profile.specializationId)?.(context) || [
    ...context.recordedActions
  ];
  return normalizeGuardianAutoattacks({ ...context, recordedActions: specialized }, specialized);
}
