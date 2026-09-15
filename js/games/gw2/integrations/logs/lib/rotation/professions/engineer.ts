import { reconstructAmalgamDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/engineer/amalgam.js';
import { reconstructEngineerDependencies } from '#gw2/integrations/logs/lib/rotation/professions/engineer/shared.js';
import { quantizeGw2ActionTimingMs, referenceCastTimeMs } from '#gw2/platform/skills/timing.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const specializationReconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['amalgam', reconstructAmalgamDpsReportActions]
]);

/** Works around EI omitting Sun Edge when its full cast appears between Radiant Arc and the reported Sun Ripper. */
function restoreEiMissingSunEdge(
  context: LogActionNormalizationContext,
  actions: readonly RecordedLogAction[]
): readonly RecordedLogAction[] {
  const sunEdge = context.catalog?.skills.find((skill) => Number(skill.id) === ID.SUN_EDGE_ID_70514) || null;
  const castTimeMs = referenceCastTimeMs(sunEdge);
  if (!sunEdge || castTimeMs <= 0) return actions;

  const restored: RecordedLogAction[] = [];
  for (const action of actions) {
    const previous = restored.at(-1);
    if (
      previous?.rawSkillId === ID.RADIANT_ARC_ID_69565 &&
      action.rawSkillId === ID.SUN_RIPPER_ID_69906 &&
      quantizeGw2ActionTimingMs(action.start - previous.end) === castTimeMs
    ) {
      restored.push({
        start: previous.end,
        end: action.start,
        rawSkillId: ID.SUN_EDGE_ID_70514,
        rawName: sunEdge.name,
        status: 'completed',
        eventIndex: action.eventIndex - 0.5,
        isSwap: false,
        metadataAccurate: false,
        expectedDurationMs: castTimeMs,
        canonicalSkillId: ID.SUN_EDGE_ID_70514,
        canonicalName: sunEdge.name
      });
    }

    restored.push(action);
  }

  return restored;
}

/** Normalizes represented Engineer actions and narrowly restores EI's omitted sword-chain opener. */
export function reconstructEngineerDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const specialized = specializationReconstructors.get(context.profile.specializationId)?.(context) || [
    ...context.recordedActions
  ];
  return restoreEiMissingSunEdge(
    context,
    reconstructEngineerDependencies({ ...context, recordedActions: specialized })
  );
}
