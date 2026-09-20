import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/shared/rotation/rules/composites.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';

const METAL_LEGION_GUITAR_FINISH_ID = 76_596;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;
const SHADOW_SHROUD_TRANSITION_IDS: ReadonlySet<number> = new Set([ID.ENTER_SHADOW_SHROUD, ID.EXIT_SHADOW_SHROUD]);
const DUPLICATE_SWAP_WINDOW_MS = 5;

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

/** Combines represented Thief animations and removes swap signals caused by Shadow Shroud bar changes. */
export function reconstructThiefDpsReportActions(context: LogActionNormalizationContext): readonly RecordedLogAction[] {
  const shroudTransitions = context.recordedActions.filter((action) =>
    SHADOW_SHROUD_TRANSITION_IDS.has(action.rawSkillId)
  );
  return mergeMetalLegionGuitar(
    context.recordedActions.filter(
      (action) =>
        !action.isSwap ||
        SHADOW_SHROUD_TRANSITION_IDS.has(action.rawSkillId) ||
        !shroudTransitions.some(
          (transition) =>
            action.start >= transition.start && action.start - transition.start <= DUPLICATE_SWAP_WINDOW_MS
        )
    )
  );
}
