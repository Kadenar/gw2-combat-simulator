import type { Skill } from '#gw2/platform/engine/types.js';
import { quicknessReferenceCastTimeMs } from '#gw2/platform/skills/timing.js';
import { catalogSkillById, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/lib/rotation/rules/composites.js';
import { primaryTargetHits } from '#gw2/integrations/logs/dps-report/rotation/target-damage.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const OVERBEARING_SMASH_ID = 69_262;
const OVERBEARING_SMASH_FINISH_ID = 63_201;
const UNLEASHED_OVERBEARING_SMASH_ID = 63_197;
const UNLEASHED_OVERBEARING_SMASH_FINISH_ID = 63_224;
const LESSER_SIC_EM_ID = 79_348;
const RANGER_PET_SPAWNED_ID = -28;
const SWAP_PETS_ID = -4;
const SUMMON_CYCLONE_BOW_ID = 76_787;
const DISMISS_CYCLONE_BOW_ID = 77_213;
const BLUSTER_ID = 77_319;
const QUARRYS_PERIL_ID = 76_807;
const SUPERSONIC_ARROW_ID = 77_174;
const MISTRAL_ID = 76_757;
const WUTHERING_WIND_ID = 76_905;
const BLUSTER_PACKETS = 3;
const SIGNAL_WINDOW_MS = 75;
const DUPLICATE_SWAP_WINDOW_MS = 5;

function actionId(action: DpsReportRecordedAction): number {
  return action.canonicalSkillId ?? action.rawSkillId;
}

function sorted(actions: readonly DpsReportRecordedAction[]): DpsReportRecordedAction[] {
  return [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}

function inferredAction(
  skill: Skill,
  start: number,
  end: number,
  eventIndex: number,
  inference: NonNullable<DpsReportRecordedAction['inference']>
): DpsReportRecordedAction {
  return {
    start,
    end,
    rawSkillId: Number(skill.id),
    rawName: skill.name,
    status: end > start ? 'completed' : 'instant',
    eventIndex,
    isSwap: false,
    metadataAccurate: false,
    inference,
    canonicalSkillId: Number(skill.id),
    canonicalName: skill.name
  };
}

/** Collapses Ranger's split smash animations into their single simulator inputs. */
function mergeSmashes(actions: readonly DpsReportRecordedAction[]): DpsReportRecordedAction[] {
  return mergeCompositeActions(
    actions,
    [
      {
        startId: OVERBEARING_SMASH_ID,
        finishId: OVERBEARING_SMASH_FINISH_ID,
        maximumGapMs: SIGNAL_WINDOW_MS,
        dropUnmatchedFinish: true
      },
      {
        startId: UNLEASHED_OVERBEARING_SMASH_ID,
        finishId: UNLEASHED_OVERBEARING_SMASH_FINISH_ID,
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
      canonicalName:
        action.rawSkillId === UNLEASHED_OVERBEARING_SMASH_ID ? 'Unleashed Overbearing Smash' : 'Overbearing Smash'
    })
  );
}

/** Removes simulator-owned Ranger procs and canonicalizes EI's pet-swap marker. */
function normalizeRangerSignals(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const normalized = mergeSmashes(actions)
    .filter((action) => {
      if ([LESSER_SIC_EM_ID, WUTHERING_WIND_ID].includes(action.rawSkillId)) return false;
      return (
        (recordedActionSkill(action, context) as (Skill & { readonly petAutonomousSkill?: boolean }) | null)
          ?.petAutonomousSkill !== true
      );
    })
    .map((action) =>
      action.rawSkillId === RANGER_PET_SPAWNED_ID
        ? {
            ...action,
            canonicalSkillId: SWAP_PETS_ID,
            canonicalName: 'Swap Pets'
          }
        : action
    );
  const bowTransitions = normalized.filter((action) =>
    [SUMMON_CYCLONE_BOW_ID, DISMISS_CYCLONE_BOW_ID].includes(actionId(action))
  );

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

/** Restores initial Cyclone Bow state when the first recorded transition dismisses an already-active bow. */
function recoverInitialCycloneBow(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const ordered = sorted(actions);
  const firstTransition = ordered.find((action) =>
    [SUMMON_CYCLONE_BOW_ID, DISMISS_CYCLONE_BOW_ID].includes(actionId(action))
  );
  if (!firstTransition || actionId(firstTransition) !== DISMISS_CYCLONE_BOW_ID) return ordered;
  const summon = catalogSkillById(context.catalog, SUMMON_CYCLONE_BOW_ID);
  const firstAction = ordered[0];
  if (!summon || !firstAction) return ordered;
  const firstSkill = recordedActionSkill(firstAction, context) as Skill & { readonly cycloneBowSkill?: boolean };
  const start = firstAction.start + (firstSkill?.cycloneBowSkill === true ? 0 : 1);
  return sorted([...ordered, inferredAction(summon, start, start, firstAction.eventIndex - 0.1, 'ranger-opening')]);
}

interface BowWindow {
  readonly start: number;
  readonly end: number;
}

function bowWindows(actions: readonly DpsReportRecordedAction[], phaseEnd: number): readonly BowWindow[] {
  const windows: BowWindow[] = [];
  let start: number | null = null;
  for (const action of sorted(actions)) {
    if (actionId(action) === SUMMON_CYCLONE_BOW_ID && start == null) start = action.start;
    if (actionId(action) !== DISMISS_CYCLONE_BOW_ID || start == null) continue;
    windows.push({ start, end: action.start });
    start = null;
  }

  if (start != null) windows.push({ start, end: phaseEnd });
  return windows;
}

function insideWindow(windows: readonly BowWindow[], start: number, end: number): boolean {
  return windows.some((window) => start >= window.start - SIGNAL_WINDOW_MS && end <= window.end + SIGNAL_WINDOW_MS);
}

/** Uses Bluster's fixed three-packet total to fill only empty Cyclone Bow openers. */
function recoverMissingBlusters(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const skill = catalogSkillById(context.catalog, BLUSTER_ID);
  const duration = quicknessReferenceCastTimeMs(skill);
  const expected = primaryTargetHits(context, BLUSTER_ID) / BLUSTER_PACKETS;
  let missing = expected - actions.filter((action) => actionId(action) === BLUSTER_ID).length;
  if (!skill || !(duration > 0) || !Number.isInteger(expected) || missing <= 0) return sorted(actions);

  const ordered = sorted(actions);
  const inferred: DpsReportRecordedAction[] = [];
  for (const window of bowWindows(ordered, context.phase.end)) {
    const firstBowAction = ordered.find((action) => {
      const rangerSkill = recordedActionSkill(action, context) as Skill & { readonly cycloneBowSkill?: boolean };
      return action.start >= window.start && action.start < window.end && rangerSkill?.cycloneBowSkill === true;
    });
    if (!firstBowAction || actionId(firstBowAction) === BLUSTER_ID) continue;
    const start = firstBowAction.start - duration;
    if (start < window.start - SIGNAL_WINDOW_MS) continue;
    inferred.push(
      inferredAction(skill, start, firstBowAction.start, firstBowAction.eventIndex - 0.1, 'ranger-damage-evidence')
    );
    missing -= 1;
    if (missing === 0) break;
  }

  return sorted([...ordered, ...inferred]);
}

/** Uses a Supersonic-to-Mistral cast-sized gap plus packet totals to restore omitted Quarry casts. */
function recoverMissingQuarries(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const skill = catalogSkillById(context.catalog, QUARRYS_PERIL_ID);
  const duration = quicknessReferenceCastTimeMs(skill);
  let missing =
    primaryTargetHits(context, QUARRYS_PERIL_ID) -
    actions.filter((action) => actionId(action) === QUARRYS_PERIL_ID).length;
  if (!skill || !(duration > 0) || !Number.isInteger(missing) || missing <= 0) return sorted(actions);

  const ordered = sorted(actions);
  const windows = bowWindows(ordered, context.phase.end);
  const inferred: DpsReportRecordedAction[] = [];
  for (const mistral of ordered.filter((action) => actionId(action) === MISTRAL_ID)) {
    const start = mistral.start - duration;
    const followsSupersonic = ordered.some(
      (action) => actionId(action) === SUPERSONIC_ARROW_ID && Math.abs(action.end - start) <= SIGNAL_WINDOW_MS
    );
    const alreadyRecorded = ordered.some(
      (action) => actionId(action) === QUARRYS_PERIL_ID && Math.abs(action.start - start) <= SIGNAL_WINDOW_MS
    );
    if (!followsSupersonic || alreadyRecorded || !insideWindow(windows, start, mistral.start)) continue;
    inferred.push(inferredAction(skill, start, mistral.start, mistral.eventIndex - 0.1, 'ranger-damage-evidence'));
    missing -= 1;
    if (missing === 0) break;
  }

  return sorted([...ordered, ...inferred]);
}

/** Applies Ranger-only log normalization and evidence-backed Galeshot recovery. */
export function reconstructRangerDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  let actions = normalizeRangerSignals(context, context.recordedActions);
  if (context.profile.specializationId !== 'galeshot') return sorted(actions);
  actions = recoverInitialCycloneBow(context, actions);
  actions = recoverMissingBlusters(context, actions);
  return recoverMissingQuarries(context, actions);
}
