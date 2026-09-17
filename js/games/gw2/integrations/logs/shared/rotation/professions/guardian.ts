import { reconstructLuminaryDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/guardian/luminary.js';
import { reconstructGuardianCompositeActions } from '#gw2/integrations/logs/shared/rotation/professions/guardian/willbender.js';
import { catalogSkillById } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';

const specializationReconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['luminary', reconstructLuminaryDpsReportActions]
]);

/** Resolves combined mantra IDs from burst timing and the bounds on possible ammo recovery. */
function reconstructMantraCharges(
  context: LogActionNormalizationContext,
  [combinedId, normalId, finalId, prepareId]: readonly number[]
): readonly RecordedLogAction[] {
  const normal = catalogSkillById(context.catalog, normalId);
  const final = catalogSkillById(context.catalog, finalId);
  const prepare = catalogSkillById(context.catalog, prepareId);
  if (!normal || !final || !prepare) return context.recordedActions;
  // Even permanent Alacrity cannot replenish a charge inside this window or rearm a spent final charge sooner.
  const chargeMs = (Number(normal.ammoRecharge) * 1000) / 1.25;
  const rearmMs = (Number(prepare.cooldown) * 1000) / 1.25;
  if (!(chargeMs > 0 && rearmMs >= 2 * chargeMs && Number(normal.ammo) === 3)) return context.recordedActions;
  const charges = context.recordedActions
    .filter((action) => [combinedId, normalId, finalId, prepareId].includes(action.rawSkillId))
    .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const replacements = new Map<RecordedLogAction, RecordedLogAction>();
  for (let index = 0; index < charges.length;) {
    let end = index + 1;
    while (end < charges.length && charges[end].start - charges[end - 1].start < chargeMs) end += 1;
    const burst = charges.slice(index, end);
    // Contradictory observations cannot establish a reliable charge history.
    if (
      (burst.length > 3 && burst.at(-1)!.start - burst[0].start < chargeMs) ||
      burst.some((action, position) => action.rawSkillId === finalId && position < burst.length - 1)
    )
      return context.recordedActions;
    // An isolated three-charge burst must finish on the final variant.
    if (
      burst.length === 3 &&
      burst[2].start - burst[0].start < chargeMs &&
      (index === 0 || burst[0].start - charges[index - 1].start >= rearmMs) &&
      (end === charges.length || charges[end].start - burst[2].start >= rearmMs) &&
      burst.every(
        (action, position) =>
          action.rawSkillId === combinedId || action.rawSkillId === (position === 2 ? final.id : normal.id)
      )
    ) {
      burst.forEach((action, position) => {
        if (action.rawSkillId !== combinedId) return;
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

  let minimumCharges = 0;
  let nextChargeAt = Infinity;
  let maximumCharges = 3;
  let nextPossibleChargeAt = Infinity;
  const rechargeMs = Number(normal.ammoRecharge) * 1000;
  for (const [index, action] of charges.entries()) {
    // Even the fastest recovery must leave only one charge before an ambiguous cast can be called final.
    while (maximumCharges < 3 && nextPossibleChargeAt <= action.start) {
      maximumCharges += 1;
      nextPossibleChargeAt = maximumCharges === 3 ? Infinity : nextPossibleChargeAt + chargeMs;
    }

    while (minimumCharges < 3 && nextChargeAt <= action.start) {
      minimumCharges += 1;
      nextChargeAt = minimumCharges === 3 ? Infinity : nextChargeAt + rechargeMs;
    }

    let skillId = replacements.get(action)?.canonicalSkillId ?? action.rawSkillId;
    const next = charges[index + 1];
    // Another charge before full rearm excludes the final variant, even in a sparse rotation.
    if (
      skillId === combinedId &&
      (minimumCharges >= 2 || (next && next.rawSkillId !== prepareId && next.start - action.start < rearmMs))
    ) {
      skillId = normalId;
      replacements.set(action, {
        ...action,
        canonicalSkillId: normalId,
        canonicalName: normal.name,
        metadataAccurate: false
      });
    } else if (skillId === combinedId && maximumCharges === 1) {
      skillId = finalId;
      replacements.set(action, {
        ...action,
        canonicalSkillId: finalId,
        canonicalName: final.name,
        metadataAccurate: false
      });
    }

    // For an unresolved cast, retaining a charge recovers a full pool no later than spending the final charge.
    if (skillId === normalId || skillId === combinedId) {
      if (maximumCharges === 3) nextPossibleChargeAt = action.start + chargeMs;
      maximumCharges -= 1;
    } else {
      maximumCharges = 3;
      nextPossibleChargeAt = Infinity;
    }

    if (skillId === normalId) {
      // ponytail: base-rate recovery assumes no recharge-slowing effects; use logged recharge state for those fights.
      // Newly proven ammo discards uncertain recharge progress rather than granting an extra early charge.
      if (minimumCharges < 2 || minimumCharges === 3) nextChargeAt = action.start + rechargeMs;
      minimumCharges = Math.max(2, minimumCharges) - 1;
    } else {
      minimumCharges = skillId === prepareId && action.status === 'completed' ? 3 : 0;
      nextChargeAt = Infinity;
    }
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
        ? [
            [-20, 41475, 42960, 41714],
            [-22, 42983, 41988, 40915]
          ].reduce(
            (actions, ids) => reconstructMantraCharges({ ...context, recordedActions: actions }, ids),
            recordedActions
          )
        : recordedActions
  };
  return specializationReconstructors.get(context.profile.specializationId)?.(normalized) || normalized.recordedActions;
}
