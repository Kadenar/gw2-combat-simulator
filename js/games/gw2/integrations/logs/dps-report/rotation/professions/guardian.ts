import { catalogSkillById, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
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

/** Applies Guardian specialization recovery and removes uncommitted autoattack animations. */
export function reconstructGuardianDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const specialized = specializationReconstructors.get(context.profile.specializationId)?.(context) || [
    ...context.recordedActions
  ];
  return normalizeAutoattackChains(specialized, {
    skillFor: (action) => recordedActionSkill(action, context),
    skillById: (skillId) => catalogSkillById(context.catalog, skillId),
    resetsChain: (action, skill) =>
      action.isSwap ||
      Number(skill?.castTimeMs || skill?.quicknessCastTimeMs || 0) > 0 ||
      skill?.handlerId === 'guardian.radiant-forge'
  });
}
