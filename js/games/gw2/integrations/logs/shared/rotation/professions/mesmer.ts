import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';
import type { Gw2SelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import { MESMER_SKILL_IDS } from '#gw2/professions/mesmer/data/ids.js';

const POWER_SPIKE_ID = 10212;
const BLINK_ID = 10200;
const BLINK_OR_PHASE_RETREAT_ID = -27;

/** Resolves represented Mesmer inputs and avoids replaying cloak gains as additional dodges. */
export function reconstructMesmerDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const config = context.professionConfig;
  const selectedSkills = config?.selectedSkillIds as Gw2SelectedSkillLoadout | undefined;
  // EI combines these teleports. A staff build without Blink makes the represented input unambiguous.
  const phaseRetreatOnly =
    selectedSkills != null &&
    !selectedSkills.includes(BLINK_ID) &&
    [config?.primaryWeapon, config?.weaponSet2Primary].includes('Staff');

  return context.recordedActions.flatMap((action) => {
    if (action.rawSkillId === BLINK_OR_PHASE_RETREAT_ID && action.canonicalSkillId == null && phaseRetreatOnly) {
      return [{ ...action, canonicalSkillId: MESMER_SKILL_IDS.PHASE_RETREAT, canonicalName: 'Phase Retreat' }];
    }

    if (action.rawSkillId === POWER_SPIKE_ID) return [{ ...action, independentTimeline: true }];

    if (context.profile.specializationId !== 'mirage' || action.rawSkillId !== -17) return [action];

    // Preserve sources identified from the raw adapter's buff, damage and effect evidence.
    if (action.canonicalSkillId != null && action.canonicalSkillId !== -17) {
      return context.recordedActions.some(
        (other) =>
          other !== action && other.rawSkillId === action.canonicalSkillId && Math.abs(other.start - action.start) < 10
      )
        ? []
        : [action];
    }

    const source = context.recordedActions.some(
      (other) =>
        [10190, 10191, 49068, -63, 10192, 10287, 43064, 45046].includes(other.rawSkillId) &&
        Math.abs(other.start - action.start) < 10
    );
    return source ? [] : [action];
  });
}
