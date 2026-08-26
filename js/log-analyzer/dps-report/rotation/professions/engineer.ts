import { reconstructAmalgamDpsReportActions } from './engineer/amalgam.js';
import { reconstructEngineerDependencies } from './engineer/shared.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '../types.js';

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
