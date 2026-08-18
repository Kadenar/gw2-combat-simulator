import { reconstructEngineerDpsReportActions } from './engineer.js';
import { reconstructElementalistDpsReportActions } from './elementalist.js';
import { reconstructGuardianDpsReportActions } from './guardian.js';
import { reconstructRevenantDpsReportActions } from './revenant.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '../types.js';

const reconstructors: ReadonlyMap<string, DpsReportProfessionActionReconstructor> = new Map([
  ['elementalist', reconstructElementalistDpsReportActions],
  ['engineer', reconstructEngineerDpsReportActions],
  ['guardian', reconstructGuardianDpsReportActions],
  ['revenant', reconstructRevenantDpsReportActions]
]);

/** Dispatches report-only corrections without coupling the generic timeline to one profession. */
export function reconstructDpsReportProfessionActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const reconstruct = reconstructors.get(context.profile.professionId);
  return reconstruct ? reconstruct(context) : [...context.recordedActions];
}
