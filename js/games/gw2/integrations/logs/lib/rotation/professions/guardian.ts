import { reconstructLuminaryDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/guardian/luminary.js';
import { reconstructGuardianCompositeActions } from '#gw2/integrations/logs/lib/rotation/professions/guardian/willbender.js';
import { catalogSkillById } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const specializationReconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['luminary', reconstructLuminaryDpsReportActions]
]);

/** Resolves complete Solace bursts without treating every third ambiguous observation as a final charge. */
function reconstructSolaceCharges(context: LogActionNormalizationContext): readonly RecordedLogAction[] {
  const normal = catalogSkillById(context.catalog, 41475);
  const final = catalogSkillById(context.catalog, 42960);
  const prepare = catalogSkillById(context.catalog, 41714);
  if (!normal || !final || !prepare) return context.recordedActions;
  // Even permanent Alacrity cannot replenish a charge inside this window or rearm a spent final charge sooner.
  const chargeMs = (Number(normal.ammoRecharge) * 1000) / 1.25;
  const rearmMs = (Number(prepare.cooldown) * 1000) / 1.25;
  if (!(chargeMs > 0 && rearmMs > chargeMs && Number(normal.ammo) === 3)) return context.recordedActions;
  const solace = context.recordedActions
    .filter((action) => [-20, 41475, 42960, 41714].includes(action.rawSkillId))
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const replacements = new Map<RecordedLogAction, RecordedLogAction>();
  for (let index = 0; index < solace.length;) {
    let end = index + 1;
    while (end < solace.length && solace[end].start - solace[end - 1].start < chargeMs) end += 1;
    const burst = solace.slice(index, end);
    // only complete isolated bursts are provable from EI's combined ID; sparse casts need additional evidence.
    if (
      burst.length === 3 &&
      burst[2].start - burst[0].start < chargeMs &&
      (index === 0 || burst[0].start - solace[index - 1].start >= rearmMs) &&
      (end === solace.length || solace[end].start - burst[2].start >= rearmMs) &&
      burst.every(
        (action, position) => action.rawSkillId === -20 || action.rawSkillId === (position === 2 ? final.id : normal.id)
      )
    ) {
      burst.forEach((action, position) => {
        if (action.rawSkillId !== -20) return;
        const skill = position === 2 ? final : normal;
        replacements.set(action, {
          ...action,
          canonicalSkillId: Number(skill.id),
          canonicalName: skill.name,
          metadataAccurate: false
        });
      });
    }

    index = end;
  }

  return context.recordedActions.map((action) => replacements.get(action) ?? action);
}

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
  const normalized = {
    ...context,
    recordedActions:
      context.profile.specializationId === 'firebrand'
        ? reconstructSolaceCharges({ ...context, recordedActions })
        : recordedActions
  };
  return specializationReconstructors.get(context.profile.specializationId)?.(normalized) || normalized.recordedActions;
}
