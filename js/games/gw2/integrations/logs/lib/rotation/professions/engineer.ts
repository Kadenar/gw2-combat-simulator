import { reconstructAmalgamDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/engineer/amalgam.js';
import { reconstructEngineerDependencies } from '#gw2/integrations/logs/lib/rotation/professions/engineer/shared.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const specializationReconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['amalgam', reconstructAmalgamDpsReportActions]
]);

/** Normalizes represented Engineer kit and specialization actions without inserting dependencies. */
export function reconstructEngineerDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const specialized = specializationReconstructors.get(context.profile.specializationId)?.(context) || [
    ...context.recordedActions
  ];
  return reconstructEngineerDependencies({ ...context, recordedActions: specialized });
}
