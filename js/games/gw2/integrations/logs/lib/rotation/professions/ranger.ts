import type { Skill } from '#gw2/platform/engine/skills/types.js';

import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/lib/rotation/rules/composites.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const UNLEASHED_OVERBEARING_SMASH_FINISH_ID = 63_224;
const RANGER_PET_SPAWNED_ID = -28;
const SIMULATOR_OWNED_SKILL_IDS: ReadonlySet<number> = new Set([ID.LESSER_SIC_EM, ID.WUTHERING_WIND]);
const CYCLONE_BOW_TRANSITION_IDS: ReadonlySet<number> = new Set([ID.SUMMON_CYCLONE_BOW, ID.DISMISS_CYCLONE_BOW]);
const SIGNAL_WINDOW_MS = 75;
const DUPLICATE_SWAP_WINDOW_MS = 5;

function actionId(action: RecordedLogAction): number {
  return action.canonicalSkillId ?? action.rawSkillId;
}

/** Collapses split hammer and spear animations before either importer interprets their cancellations. */
function mergeWeaponAnimations(actions: readonly RecordedLogAction[]): RecordedLogAction[] {
  return mergeCompositeActions(
    actions,
    [
      {
        startId: ID.OVERBEARING_SMASH,
        finishId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        maximumGapMs: SIGNAL_WINDOW_MS
      },
      {
        startId: ID.UNLEASHED_OVERBEARING_SMASH,
        finishId: UNLEASHED_OVERBEARING_SMASH_FINISH_ID,
        maximumGapMs: SIGNAL_WINDOW_MS
      },
      {
        startId: ID.WOLFS_ONSLAUGHT,
        finishId: 73043,
        maximumGapMs: SIGNAL_WINDOW_MS,
        dropUnmatchedFinish: true
      }
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
      canonicalName: action.rawName
    })
  );
}

/** Removes simulator-owned Ranger procs and canonicalizes EI's pet-swap marker. */
function normalizeRangerSignals(
  context: LogActionNormalizationContext,
  actions: readonly RecordedLogAction[]
): RecordedLogAction[] {
  const normalized = mergeWeaponAnimations(actions)
    .filter((action) => {
      if (SIMULATOR_OWNED_SKILL_IDS.has(action.rawSkillId)) return false;
      return (
        (recordedActionSkill(action, context) as (Skill & { readonly petAutonomousSkill?: boolean }) | null)
          ?.petAutonomousSkill !== true
      );
    })
    .map((action) =>
      action.rawSkillId === RANGER_PET_SPAWNED_ID
        ? {
            ...action,
            canonicalSkillId: ID.PET_SWAP,
            canonicalName: 'Swap Pets'
          }
        : action
    );
  const bowTransitions = normalized.filter((action) => CYCLONE_BOW_TRANSITION_IDS.has(actionId(action)));

  // EI adds a generic weapon-swap row one millisecond after every Cyclone Bow transition.
  return normalized.filter(
    (action) =>
      !(
        action.isSwap &&
        String(action.rawName).trim().toLowerCase() === 'weapon swap' &&
        bowTransitions.some(
          (transition) =>
            action.start >= transition.start && action.start - transition.start <= DUPLICATE_SWAP_WINDOW_MS
        )
      )
  );
}

/** Maps represented Ranger actions and filters simulator-owned signals. */
export function reconstructRangerDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  return normalizeRangerSignals(context, context.recordedActions);
}
