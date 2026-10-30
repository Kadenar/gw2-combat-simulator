import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';
import { mergeCompositeActions } from '#gw2/integrations/logs/shared/rotation/rules/composites.js';
import { resolveSelectedAmalgamMorphId } from '#gw2/professions/engineer/build/morphs.js';

const COMPOSITE_SIGNAL_WINDOW_MS = 150;

/** Merges split animations and binds recorded protocols to the build's selected slots without altering source evidence. */
export function reconstructAmalgamDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const merged = mergeCompositeActions(
    context.recordedActions,
    [
      {
        startName: 'Offensive Protocol: Demolish',
        finishName: 'Offensive Protocol: Demolish',
        finishId: 77013,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS,
        finishStartsAfterStartEnd: true
      },
      {
        startName: 'Plasmatic State',
        finishName: 'Plasmatic State',
        finishId: 77307,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS,
        finishStartsAfterStartEnd: true
      }
    ],
    (action, followUp) => ({
      ...action,
      end: Math.max(action.end, followUp.end),
      status: followUp.status,
      metadataAccurate: action.metadataAccurate && followUp.metadataAccurate
    })
  );
  const selectedIds = context.professionConfig?.selectedMorphSkillIds;

  if (!Array.isArray(selectedIds)) return merged;

  const selectedSkillIds =
    context.catalog?.skills.filter((skill) => selectedIds.includes(skill.id)).map((skill) => skill.id) ?? [];
  return merged.map((action) => {
    const recordedId = action.canonicalSkillId ?? action.rawSkillId;
    const selectedId = resolveSelectedAmalgamMorphId(recordedId, selectedSkillIds);

    if (selectedId === recordedId) return action;

    // Only an explicitly selected instance of the same protocol can replace its recorded slot identity.
    const selected = context.catalog?.skillsById.get(selectedId);
    return selected && typeof selected.id === 'number'
      ? { ...action, canonicalSkillId: selected.id, canonicalName: selected.name }
      : action;
  });
}
