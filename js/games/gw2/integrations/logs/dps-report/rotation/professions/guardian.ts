import type { Skill } from '#gw2/platform/engine/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { normalizeAutoattackChains } from '#gw2/integrations/logs/lib/rotation/rules/autoattack-chains.js';
import { reconstructDragonhunterDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/guardian/dragonhunter.js';
import { reconstructLuminaryDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/guardian/luminary.js';
import { reconstructWillbenderDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/guardian/willbender.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const specializationReconstructors: ReadonlyMap<string, DpsReportProfessionActionReconstructor> = new Map([
  ['dragonhunter', reconstructDragonhunterDpsReportActions],
  ['luminary', reconstructLuminaryDpsReportActions],
  ['willbender', reconstructWillbenderDpsReportActions]
]);

function actionSkill(action: DpsReportRecordedAction, context: DpsReportProfessionReconstructionContext): Skill | null {
  return findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile
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
