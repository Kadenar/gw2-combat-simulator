import { catalogSkillById, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { normalizeAutoattackChains } from '#gw2/integrations/logs/lib/rotation/rules/autoattack-chains.js';
import {
  firstStrikePacketOffsetMs,
  isUncommittedCast,
  quicknessRuntimeDurationMs,
  replayInterruptDurationMs
} from '#gw2/integrations/logs/lib/rotation/timing.js';
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

/** Normalizes represented Guardian variants and chains while preserving cancelled inputs. */
export function reconstructGuardianDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const specialized = specializationReconstructors.get(context.profile.specializationId)?.(context) || [
    ...context.recordedActions
  ];
  return normalizeAutoattackChains(specialized, {
    skillFor: (action) => recordedActionSkill(action, context),
    skillById: (skillId) => catalogSkillById(context.catalog, skillId),
    resetsChain: (action, skill) => {
      if (action.isSwap || skill?.handlerId === 'guardian.radiant-forge') return true;
      const duration = action.end - action.start;
      const runtime = quicknessRuntimeDurationMs(skill);
      const firstStrike = firstStrikePacketOffsetMs(skill);
      // Match runtime chain resets: cancelled, non-damaging, and delayed-damage casts preserve the pending step.
      return (
        runtime > 0 &&
        skill?.independentCast !== true &&
        !isUncommittedCast(skill, duration) &&
        firstStrike != null &&
        firstStrike <= Math.min(runtime, replayInterruptDurationMs(skill, duration))
      );
    }
  });
}
