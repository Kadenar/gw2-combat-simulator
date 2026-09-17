import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/shared/rotation/rules/composites.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { dragonChargesForDurationMs } from '#gw2/professions/warrior/data/dragon-charges.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';

const REND_ANIMATION_ID = 80_247;
const REND_FOLLOW_UP_ANIMATION_ID = 80_224;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;
const DUPLICATE_SWAP_WINDOW_MS = 5;
const GUNSABER_TRANSITION_IDS: ReadonlySet<number> = new Set([ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER]);
const DRAGON_SLASH_IDS: ReadonlySet<number> = new Set([
  ID.DRAGON_SLASH_FORCE,
  ID.DRAGON_SLASH_BOOST,
  ID.DRAGON_SLASH_REACH,
  ID.SHARP_DRAGON_SLASH_FORCE,
  ID.SHARP_DRAGON_SLASH_BOOST,
  ID.SHARP_DRAGON_SLASH_REACH
]);
const TACTICAL_RELOAD_DURATION_MS = 10_000;

/** Removes Dragon Trigger's duplicate bar-change signal and transfers its observed charge tier to Dragon Slash. */
function reconstructDragonTriggerActions(actions: readonly RecordedLogAction[]): readonly RecordedLogAction[] {
  const filtered = actions.filter(
    (action) =>
      action.rawSkillId !== ID.UNSHEATHE_GUNSABER ||
      !actions.some(
        (candidate) =>
          candidate.rawSkillId === ID.DRAGON_TRIGGER &&
          candidate.start >= action.start &&
          candidate.start - action.start <= DUPLICATE_SWAP_WINDOW_MS
      )
  );
  let tacticalReloadUntil = Number.NEGATIVE_INFINITY;
  let pendingReleaseAtCharges: number | null = null;

  return filtered.map((action) => {
    if (action.rawSkillId === ID.TACTICAL_RELOAD) {
      tacticalReloadUntil = action.end + TACTICAL_RELOAD_DURATION_MS;
      return action;
    }

    if (action.rawSkillId === ID.DRAGON_TRIGGER) {
      const tacticalReload = action.start <= tacticalReloadUntil;
      if (tacticalReload) tacticalReloadUntil = Number.NEGATIVE_INFINITY;
      const replayDurationMs = quantizeGw2ActionTimingMs(action.end - action.start);
      pendingReleaseAtCharges =
        replayDurationMs > 0 ? dragonChargesForDurationMs(replayDurationMs, 10, tacticalReload ? 2 : 1) : null;
      return replayDurationMs > 0 ? { ...action, replayDurationMs } : action;
    }

    if (DRAGON_SLASH_IDS.has(action.rawSkillId) && pendingReleaseAtCharges != null) {
      const releaseAtCharges = pendingReleaseAtCharges;
      pendingReleaseAtCharges = null;
      return { ...action, releaseAtCharges };
    }

    return action;
  });
}

/** Collapses composite animations and removes EI bar-change artifacts while preserving their modeled timing. */
export function reconstructWarriorDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const composites = mergeCompositeActions(
    context.recordedActions,
    [
      {
        startId: REND_ANIMATION_ID,
        finishId: REND_FOLLOW_UP_ANIMATION_ID,
        maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS
      },
      { startId: 14446, finishId: 14493, maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS }
    ],
    (action, followUp) => ({
      ...action,
      end: Math.max(action.end, followUp.end),
      status: mergedActionStatus(action.status, followUp.status),
      metadataAccurate: action.metadataAccurate && followUp.metadataAccurate,
      expectedDurationMs:
        Number(action.expectedDurationMs || action.end - action.start) +
        Number(followUp.expectedDurationMs || followUp.end - followUp.start),
      canonicalSkillId: action.rawSkillId,
      canonicalName: action.rawSkillId === REND_ANIMATION_ID ? 'Rend' : 'Rush'
    })
  );

  const gunsaberTransitions = composites.filter((action) => GUNSABER_TRANSITION_IDS.has(action.rawSkillId));
  return reconstructDragonTriggerActions(
    composites.filter(
      (action) =>
        !action.isSwap ||
        !gunsaberTransitions.some(
          (transition) =>
            action.start >= transition.start && action.start - transition.start <= DUPLICATE_SWAP_WINDOW_MS
        )
    )
  );
}
