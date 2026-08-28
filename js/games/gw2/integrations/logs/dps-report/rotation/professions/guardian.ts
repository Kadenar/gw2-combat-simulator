import type { Skill } from '../../../../../platform/engine/types.js';
import { normalizeAutoattackChains } from '../../../lib/rotation/rules/autoattack-chains.js';
import { reconstructDragonhunterDpsReportActions } from './guardian/dragonhunter.js';
import { reconstructLuminaryDpsReportActions } from './guardian/luminary.js';
import { reconstructWillbenderDpsReportActions } from './guardian/willbender.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '../types.js';

const specializationReconstructors: ReadonlyMap<string, DpsReportProfessionActionReconstructor> = new Map([
  ['dragonhunter', reconstructDragonhunterDpsReportActions],
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

/** Applies Guardian specialization recovery and removes uncommitted autoattack animations. */
export function reconstructGuardianDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const specialized = specializationReconstructors.get(context.profile.specializationId)?.(context) || [
    ...context.recordedActions
  ];
  return normalizeAutoattackChains(specialized, {
    skillFor: (action) => actionSkill(action, context),
    skillById: (skillId) =>
      context.catalog?.skills.find(
        (candidate) => typeof candidate.id === 'number' && Number(candidate.id) === skillId
      ) || null,
    resetsChain: (action, skill) =>
      action.isSwap ||
      Number(skill?.castTimeMs || skill?.quicknessCastTimeMs || 0) > 0 ||
      skill?.handlerId === 'guardian.radiant-forge'
  });
}
