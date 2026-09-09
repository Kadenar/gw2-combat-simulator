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

/** Normalizes represented Guardian variants; recorded chain IDs stay intact so the simulator owns chain state. */
export function reconstructGuardianDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  return specializationReconstructors.get(context.profile.specializationId)?.(context) || [...context.recordedActions];
}
