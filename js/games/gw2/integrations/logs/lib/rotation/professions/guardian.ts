import { reconstructLuminaryDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/guardian/luminary.js';
import { reconstructGuardianCompositeActions } from '#gw2/integrations/logs/lib/rotation/professions/guardian/willbender.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const specializationReconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['luminary', reconstructLuminaryDpsReportActions]
]);

/** Normalizes represented Guardian variants; recorded chain IDs stay intact so the simulator owns chain state. */
export function reconstructGuardianDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  // Weaponmaster Training makes the sword composite available to every Guardian specialization.
  const normalized = { ...context, recordedActions: reconstructGuardianCompositeActions(context) };
  return specializationReconstructors.get(context.profile.specializationId)?.(normalized) || normalized.recordedActions;
}
