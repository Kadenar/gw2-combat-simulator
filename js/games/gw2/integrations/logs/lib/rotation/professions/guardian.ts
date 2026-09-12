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
  const composites = reconstructGuardianCompositeActions(context);
  // EI emits a bundle swap 1 ms after tome entry/stow; neither transition swaps weapons or cancels an animation.
  const tomeIds = new Set([44364, 41780, 42259, 42371, 41380]);
  const recordedActions =
    context.profile.specializationId === 'firebrand'
      ? composites.filter(
          (action) =>
            !action.isSwap ||
            !composites.some((tome) => tomeIds.has(tome.rawSkillId) && Math.abs(action.start - tome.start) <= 5)
        )
      : composites;
  const normalized = { ...context, recordedActions };
  return specializationReconstructors.get(context.profile.specializationId)?.(normalized) || normalized.recordedActions;
}
