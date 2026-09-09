import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/lib/rotation/rules/composites.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const METAL_LEGION_GUITAR_FINISH_ID = 76_596;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

/** Combines represented Guitar and Twilight Combo animation segments into their single player input. */
function mergeMetalLegionGuitar(actions: readonly RecordedLogAction[]): RecordedLogAction[] {
  return mergeCompositeActions(
    actions,
    [
      {
        startId: ID.METAL_LEGION_GUITAR,
        finishId: METAL_LEGION_GUITAR_FINISH_ID,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS
      },
      { startId: 63254, finishId: 63181, maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS }
    ],
    (action, finish) => ({
      ...action,
      end: Math.max(action.end, finish.end),
      status: mergedActionStatus(action.status, finish.status),
      metadataAccurate: action.metadataAccurate && finish.metadataAccurate,
      expectedDurationMs:
        Number(action.expectedDurationMs || action.end - action.start) +
        Number(finish.expectedDurationMs || finish.end - finish.start),
      canonicalSkillId: action.rawSkillId,
      canonicalName: action.rawSkillId === 63254 ? 'Twilight Combo' : 'Metal Legion Guitar'
    })
  );
}

/** Combines represented Thief animation segments without inventing inputs or random outcomes. */
export function reconstructThiefDpsReportActions(context: LogActionNormalizationContext): readonly RecordedLogAction[] {
  return mergeMetalLegionGuitar(context.recordedActions);
}
