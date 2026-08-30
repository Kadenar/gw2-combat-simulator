import { reconstructAmalgamDpsReportActions } from '#gw2/integrations/logs/dps-report/rotation/professions/engineer/amalgam.js';
import { reconstructEngineerDependencies } from '#gw2/integrations/logs/dps-report/rotation/professions/engineer/shared.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const specializationReconstructors: ReadonlyMap<string, DpsReportProfessionActionReconstructor> = new Map([
  ['amalgam', reconstructAmalgamDpsReportActions]
]);

/** Applies Engineer-wide dependency recovery after specialization-specific cast normalization. */
export function reconstructEngineerDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const specialized = specializationReconstructors.get(context.profile.specializationId)?.(context) || [
    ...context.recordedActions
  ];
  return reconstructEngineerDependencies({ ...context, recordedActions: specialized });
}
