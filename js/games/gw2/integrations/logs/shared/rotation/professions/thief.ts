import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';
import { mergeCompositeActions, mergedActionStatus } from '#gw2/integrations/logs/shared/rotation/rules/composites.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

const METAL_LEGION_GUITAR_FINISH_ID = 76_596;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;
const SHADOW_SHROUD_TRANSITION_IDS: ReadonlySet<number> = new Set([ID.ENTER_SHADOW_SHROUD, ID.EXIT_SHADOW_SHROUD]);
const DUPLICATE_SWAP_WINDOW_MS = 5;

/** Composite animations belong to one input, so their second segment cannot spend resources or rearm a follow-up. */
function mergeThiefCompositeActions(actions: readonly RecordedLogAction[]): RecordedLogAction[] {
  return mergeCompositeActions(
    actions,
    [
      {
        startId: ID.METAL_LEGION_GUITAR,
        finishId: METAL_LEGION_GUITAR_FINISH_ID,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS
      },
      { startId: 63254, finishId: 63181, maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS },
      { startId: ID.SHADOW_SHOT, finishId: 13039, maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS },
      { startId: ID.SHADOW_STRIKE, finishId: 13051, maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS }
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
      canonicalName:
        action.rawSkillId === ID.SHADOW_STRIKE
          ? 'Shadow Strike'
          : action.rawSkillId === ID.SHADOW_SHOT
            ? 'Shadow Shot'
            : action.rawSkillId === 63254
              ? 'Twilight Combo'
              : 'Metal Legion Guitar'
    })
  );
}

/** EI can report an inaccurate instant Strike marker inside its animation; both describe one initiative spend. */
function removeInfiltratorsStrikeMarkers(actions: readonly RecordedLogAction[]): readonly RecordedLogAction[] {
  const animations = actions.filter(
    (action) => action.rawSkillId === ID.INFILTRATORS_STRIKE && action.end > action.start
  );
  return actions.filter(
    (action) =>
      action.rawSkillId !== ID.INFILTRATORS_STRIKE ||
      action.status !== 'instant' ||
      action.metadataAccurate ||
      !animations.some((animation) => action.start >= animation.start && action.start <= animation.end)
  );
}

/** Combines Thief animations and removes corroborating Strike markers and Shadow Shroud swap signals. */
export function normalizeThiefLogActions(context: LogActionNormalizationContext): readonly RecordedLogAction[] {
  const shroudTransitions = context.recordedActions.filter((action) =>
    SHADOW_SHROUD_TRANSITION_IDS.has(action.rawSkillId)
  );
  return mergeThiefCompositeActions(
    removeInfiltratorsStrikeMarkers(context.recordedActions).filter(
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
