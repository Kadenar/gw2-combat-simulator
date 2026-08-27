import { mergedActionStatus, mergeCompositeActions } from '../../../lib/rotation/rules/composites.js';
import { findRotationSkill } from '../../../lib/rotation/catalog.js';
import {
  firstStrikePacketOffsetMs,
  openingStrikeCombatStartMs,
  quicknessRuntimeDurationMs
} from '../../../lib/rotation/timing.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../types.js';

const REND_ANIMATION_ID = 80_247;
const REND_FOLLOW_UP_ANIMATION_ID = 80_224;
const HEAD_BUTT_ID = 30_343;
const COMPOSITE_SIGNAL_WINDOW_MS = 75;

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/** Anchors a pre-phase Head Butt to its strike packet so the replay does not gate away its damage. */
function alignOpeningHeadButtCombatStart(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const opening = actions
    .filter(
      (action) =>
        (action.rawSkillId === HEAD_BUTT_ID || normalized(action.rawName) === 'head butt') &&
        action.start <= context.phase.start &&
        context.phase.start <= action.end + COMPOSITE_SIGNAL_WINDOW_MS
    )
    .sort((left, right) => right.start - left.start)[0];
  if (!opening) return [...actions];
  const skill = findRotationSkill(opening.rawSkillId, opening.rawName, context.catalog, context.profile);
  const runtimeDuration = quicknessRuntimeDurationMs(skill);
  const strikeOffset = firstStrikePacketOffsetMs(skill, runtimeDuration, { explicitOnly: true });
  if (strikeOffset == null) return [...actions];
  const combatStartOverride = openingStrikeCombatStartMs(opening.start, strikeOffset, context.phase.start);
  return actions.map((action) => (action === opening ? { ...action, combatStartOverride } : action));
}

/** Collapses Rend's two serial EI animation rows into the single player cast that produced them. */
export function reconstructWarriorDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  return alignOpeningHeadButtCombatStart(
    context,
    mergeCompositeActions(
      context.recordedActions,
      [
        {
          startId: REND_ANIMATION_ID,
          finishId: REND_FOLLOW_UP_ANIMATION_ID,
          maximumGapMs: COMPOSITE_SIGNAL_WINDOW_MS,
          dropUnmatchedFinish: true
        }
      ],
      (action, followUp) => ({
        ...action,
        end: Math.max(action.end, followUp.end),
        status: mergedActionStatus(action.status, followUp.status),
        metadataAccurate: action.metadataAccurate && followUp.metadataAccurate,
        expectedDurationMs:
          Number(action.expectedDurationMs || action.end - action.start) +
          Number(followUp.expectedDurationMs || followUp.end - followUp.start),
        canonicalSkillId: REND_ANIMATION_ID,
        canonicalName: 'Rend'
      })
    )
  );
}
