import { reconstructAmalgamDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/engineer/amalgam.js';
import { reconstructEngineerDependencies } from '#gw2/integrations/logs/shared/rotation/professions/engineer/shared.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import { referenceCastTimeMs } from '#gw2/platform/execution/cast-timing.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';

const specializationReconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['amalgam', reconstructAmalgamDpsReportActions]
]);

/** Works around EI omitting Sun Edge when its full cast appears between Radiant Arc and the reported Sun Ripper. */
function restoreEiMissingSunEdge(
  context: LogActionNormalizationContext,
  actions: readonly RecordedLogAction[]
): readonly RecordedLogAction[] {
  const sunEdge = context.catalog?.skills.find((skill) => Number(skill.id) === ID.SUN_EDGE_NON_HOLOSMITH) || null;
  const castTimeMs = referenceCastTimeMs(sunEdge);
  if (!sunEdge || castTimeMs <= 0) return actions;

  const restored: RecordedLogAction[] = [];
  for (const action of actions) {
    const previous = restored.at(-1);
    if (
      previous?.rawSkillId === ID.RADIANT_ARC_NON_HOLOSMITH &&
      action.rawSkillId === ID.SUN_RIPPER_NON_HOLOSMITH &&
      quantizeGw2ActionTimingMs(action.start - previous.end) === castTimeMs
    ) {
      restored.push({
        start: previous.end,
        end: action.start,
        rawSkillId: ID.SUN_EDGE_NON_HOLOSMITH,
        rawName: sunEdge.name,
        status: 'completed',
        eventIndex: action.eventIndex - 0.5,
        isSwap: false,
        metadataAccurate: false,
        expectedDurationMs: castTimeMs,
        canonicalSkillId: ID.SUN_EDGE_NON_HOLOSMITH,
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
