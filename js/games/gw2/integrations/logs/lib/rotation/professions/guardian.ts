import { catalogSkillById, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { normalizeAutoattackChains } from '#gw2/integrations/logs/lib/rotation/rules/autoattack-chains.js';
import { reconstructLuminaryDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/guardian/luminary.js';
import { reconstructWillbenderDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/guardian/willbender.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const specializationReconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['luminary', reconstructLuminaryDpsReportActions],
  ['willbender', reconstructWillbenderDpsReportActions]
]);

/** Normalizes represented Guardian variants and chains while preserving cancelled inputs. */
export function reconstructGuardianDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
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
